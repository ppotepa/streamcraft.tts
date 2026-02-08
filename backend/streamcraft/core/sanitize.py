"""Audio sanitization helpers for the Streamcraft pipeline."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import numpy as np
import soundfile as sf

from streamcraft.core.pipeline import resolve_output_dirs

PREVIEW_SAMPLE_RATE = 24000


@dataclass
class SanitizeSettings:
	silence_threshold_db: float = -45.0
	min_segment_ms: int = 800
	merge_gap_ms: int = 300
	target_peak_db: float = -1.0
	fade_ms: int = 20


@dataclass
class Segment:
	start: float
	end: float
	rms_db: float

	@property
	def duration(self) -> float:
		return max(0.0, self.end - self.start)


def _to_mono(audio: np.ndarray) -> np.ndarray:
	if audio.ndim == 1:
		return audio
	return audio.mean(axis=1)


def _load_audio(path: Path) -> Tuple[np.ndarray, int]:
	data, sr = sf.read(str(path), always_2d=False)
	if data.dtype != np.float32:
		data = data.astype(np.float32)
	return data, int(sr)


def _compute_rms_envelope(audio: np.ndarray, frame_samples: int) -> np.ndarray:
	total_frames = len(audio) // frame_samples
	if total_frames == 0:
		return np.array([], dtype=np.float32)
	trimmed = audio[: total_frames * frame_samples]
	framed = trimmed.reshape(total_frames, frame_samples)
	rms = np.sqrt(np.mean(framed * framed, axis=1) + 1e-9)
	return rms.astype(np.float32)


def detect_segments(audio: np.ndarray, sr: int, settings: SanitizeSettings) -> List[Segment]:
	mono = _to_mono(audio)
	frame_ms = 50
	frame_samples = max(1, int(sr * frame_ms / 1000))
	rms = _compute_rms_envelope(mono, frame_samples)
	if rms.size == 0:
		return []

	threshold = math.pow(10.0, settings.silence_threshold_db / 20.0)
	mask = rms >= threshold

	frame_duration = frame_samples / sr
	min_segment_frames = max(1, int(settings.min_segment_ms / 1000 / frame_duration))
	merge_gap_frames = max(1, int(settings.merge_gap_ms / 1000 / frame_duration))

	segments: List[Segment] = []
	start_idx = None
	for idx, active in enumerate(mask):
		if active:
			if start_idx is None:
				start_idx = idx
		else:
			if start_idx is not None:
				end_idx = idx
				if end_idx - start_idx >= min_segment_frames:
					seg = Segment(
						start=start_idx * frame_duration,
						end=end_idx * frame_duration,
						rms_db=float(20 * math.log10(float(np.mean(rms[start_idx:end_idx]) + 1e-9))),
					)
					segments.append(seg)
				start_idx = None
	if start_idx is not None:
		seg = Segment(
			start=start_idx * frame_duration,
			end=len(mask) * frame_duration,
			rms_db=float(20 * math.log10(float(np.mean(rms[start_idx:]) + 1e-9))),
		)
		if seg.duration * 1000 >= settings.min_segment_ms:
			segments.append(seg)

	if not segments:
		return []

	merged: List[Segment] = []
	current = segments[0]
	for next_seg in segments[1:]:
		gap_frames = (next_seg.start - current.end) / frame_duration
		if gap_frames <= merge_gap_frames:
			current = Segment(start=current.start, end=next_seg.end, rms_db=max(current.rms_db, next_seg.rms_db))
		else:
			merged.append(current)
			current = next_seg
	merged.append(current)
	return merged


def _apply_fade(chunk: np.ndarray, sr: int, settings: SanitizeSettings) -> np.ndarray:
	fade_samples = max(1, int(sr * settings.fade_ms / 1000))
	if len(chunk) < fade_samples * 2:
		return chunk
	window = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
	chunk[:fade_samples] *= window
	chunk[-fade_samples:] *= window[::-1]
	return chunk


def build_clean_audio(audio: np.ndarray, sr: int, segments: Sequence[Segment], settings: SanitizeSettings) -> np.ndarray:
	if not segments:
		raise ValueError("No speech segments detected; cannot build clean audio")

	pieces: List[np.ndarray] = []
	mono = _to_mono(audio)
	for seg in segments:
		start_idx = max(0, int(seg.start * sr))
		end_idx = min(len(mono), int(seg.end * sr))
		chunk = mono[start_idx:end_idx].copy()
		if chunk.size == 0:
			continue
		chunk = _apply_fade(chunk, sr, settings)
		pieces.append(chunk)

	if not pieces:
		raise ValueError("Could not extract any audio chunks from detected segments")

	clean = np.concatenate(pieces)
	peak = np.max(np.abs(clean))
	if peak > 0:
		target = math.pow(10.0, settings.target_peak_db / 20.0)
		clean = clean * (target / peak)
	return clean.astype(np.float32)


def write_manifest(segments: Sequence[Segment], sr: int, source: Path, path: Path) -> None:
	payload = {
		"sampleRate": sr,
		"source": str(source),
		"segments": [
			{
				"start": seg.start,
				"end": seg.end,
				"duration": seg.duration,
				"rmsDb": seg.rms_db,
			}
			for seg in segments
		],
	}
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _resample_linear(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
	if src_sr == dst_sr:
		return audio.copy()
	duration = len(audio) / src_sr
	dst_len = max(1, int(round(duration * dst_sr)))
	if dst_len <= 1:
		return np.zeros(1, dtype=np.float32)
	src_samples = np.linspace(0.0, duration, num=len(audio), endpoint=False)
	dst_samples = np.linspace(0.0, duration, num=dst_len, endpoint=False)
	resampled = np.interp(dst_samples, src_samples, audio)
	return resampled.astype(np.float32)


def sanitize_audio(
	input_wav: Path,
	clean_path: Path,
	manifest_path: Path,
	settings: SanitizeSettings,
) -> Tuple[Path, Path, Path, List[Segment], int, int, List[str]]:
	log: List[str] = []

	def emit(msg: str) -> None:
		log.append(msg)

	if not input_wav.exists():
		raise FileNotFoundError(f"Input audio missing: {input_wav}")

	emit(f"Loading audio {input_wav}")
	audio, sr = _load_audio(input_wav)
	emit(f"Loaded waveform sr={sr} hz, duration={len(audio)/sr:.2f}s")

	segments = detect_segments(audio, sr, settings)
	emit(f"Detected {len(segments)} speech segments")

	clean_audio = build_clean_audio(audio, sr, segments, settings)
	emit(f"Clean mix length {len(clean_audio)/sr:.2f}s, exporting {clean_path}")
	clean_path.parent.mkdir(parents=True, exist_ok=True)
	sf.write(str(clean_path), clean_audio, sr)

	preview_path = clean_path.with_name(f"{clean_path.stem}_preview.wav")
	preview_audio = _resample_linear(clean_audio, sr, PREVIEW_SAMPLE_RATE)
	emit(f"Writing preview {preview_path} @ {PREVIEW_SAMPLE_RATE} hz")
	sf.write(str(preview_path), preview_audio, PREVIEW_SAMPLE_RATE)

	emit(f"Writing manifest {manifest_path}")
	write_manifest(segments, sr, input_wav, manifest_path)

	return clean_path, manifest_path, preview_path, segments, sr, PREVIEW_SAMPLE_RATE, log


def run_sanitize_job(
	vod_url: str,
	out_root: Path,
	dataset_root: Path,
	settings: SanitizeSettings | None = None,
) -> Tuple[Path, Path, Path, List[Segment], int, int, List[str]]:
	settings = settings or SanitizeSettings()

	_, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
	vod_slug = vod_dir.name
	input_audio = vod_dir / f"{vod_slug}_full.wav"
	clean_path = vod_dir / f"{vod_slug}_clean.wav"
	manifest_path = dataset_dir / f"{vod_slug}_segments.json"

	return sanitize_audio(input_audio, clean_path, manifest_path, settings)
