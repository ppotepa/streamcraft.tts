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


def _clamp(value: float, low: float, high: float) -> float:
	return max(low, min(high, value))


def estimate_settings(audio: np.ndarray, sr: int, base: SanitizeSettings | None = None) -> SanitizeSettings:
	"""Derive reasonable sanitize settings from audio stats.

	Uses a short RMS scan to infer noise floor and typical speech cadence, then
	chooses threshold/segment/gap values that should work well for conversational speech.
	"""
	base = base or SanitizeSettings()
	mono = _to_mono(audio)
	frame_ms = 50
	frame_samples = max(1, int(sr * frame_ms / 1000))
	rms = _compute_rms_envelope(mono, frame_samples)
	if rms.size == 0:
		return base

	rms_db = 20 * np.log10(rms + 1e-9)
	noise_floor_db = float(np.percentile(rms_db, 20))
	speech_peak_db = float(np.percentile(rms_db, 90))

	# Threshold: a bit above noise, but not so high we cut soft speech
	threshold_db = _clamp(noise_floor_db + 6.0, -55.0, speech_peak_db - 6.0)
	if math.isnan(threshold_db):
		threshold_db = base.silence_threshold_db

	# Derive cadence stats to set min segment and merge gap
	mask = rms_db >= threshold_db
	frame_duration = frame_samples / sr
	segments: List[Segment] = []
	start_idx = None
	for idx, active in enumerate(mask):
		if active and start_idx is None:
			start_idx = idx
		elif not active and start_idx is not None:
			segments.append((start_idx, idx))
			start_idx = None
	if start_idx is not None:
		segments.append((start_idx, len(mask)))

	if segments:
		durations_ms = [max(1.0, (end - start) * frame_duration * 1000.0) for start, end in segments]
		gaps_ms = [max(1.0, (segments[i][0] - segments[i - 1][1]) * frame_duration * 1000.0) for i in range(1, len(segments))]
		min_seg_ms = int(_clamp(np.percentile(durations_ms, 25), 300.0, 1800.0))
		merge_gap_ms = int(_clamp(np.percentile(gaps_ms, 50) if gaps_ms else 300.0, 120.0, 900.0))
	else:
		min_seg_ms = base.min_segment_ms
		merge_gap_ms = base.merge_gap_ms

	return SanitizeSettings(
		silence_threshold_db=float(threshold_db),
		min_segment_ms=int(min_seg_ms),
		merge_gap_ms=int(merge_gap_ms),
		target_peak_db=base.target_peak_db,
		fade_ms=base.fade_ms,
	)


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
	auto: bool = False,
	voice_samples_dir: Path | None = None,
	voice_sample_count: int = 0,
	voice_sample_max_sec: float = 6.0,
	voice_sample_min_duration: float = 2.0,
	voice_sample_max_duration: float = 6.0,
	voice_sample_min_rms_db: float = -35.0,
	manual_samples: List[Dict] | None = None,
) -> Tuple[Path, Path, Path, List[Segment], int, int, List[str], SanitizeSettings, List[Dict]]:
	log: List[str] = []

	def emit(msg: str) -> None:
		log.append(msg)

	if not input_wav.exists():
		raise FileNotFoundError(f"Input audio missing: {input_wav}")

	emit(f"Loading audio {input_wav}")
	audio, sr = _load_audio(input_wav)
	emit(f"Loaded waveform sr={sr} hz, duration={len(audio)/sr:.2f}s")

	if auto:
		auto_settings = estimate_settings(audio, sr, settings)
		emit(
			"Auto settings -> "
			f"silence_threshold_db={auto_settings.silence_threshold_db:.1f}, "
			f"min_segment_ms={auto_settings.min_segment_ms}, merge_gap_ms={auto_settings.merge_gap_ms}, "
			f"target_peak_db={auto_settings.target_peak_db}, fade_ms={auto_settings.fade_ms}"
		)
		settings = auto_settings

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

	voice_samples: List[Dict] = []
	if voice_samples_dir:
		voice_samples_dir.mkdir(parents=True, exist_ok=True)
		if manual_samples and voice_sample_count > 0:
			# Use manual samples as references to find similar segments
			emit(f"Analyzing {len(manual_samples)} reference region(s) to find similar clips")
			
			# Extract characteristics from reference regions
			ref_durations = []
			ref_rms_dbs = []
			for sample_spec in manual_samples:
				start_sec = sample_spec.get("start", 0.0)
				end_sec = sample_spec.get("end", 0.0)
				start_idx = max(0, int(start_sec * sr))
				end_idx = min(len(audio), int(end_sec * sr))
				if end_idx <= start_idx:
					continue
				snip = _to_mono(audio[start_idx:end_idx].copy())
				if snip.size == 0:
					continue
				duration = end_sec - start_sec
				rms = float(np.sqrt(np.mean(snip**2)))
				rms_db = 20 * np.log10(rms + 1e-10)
				ref_durations.append(duration)
				ref_rms_dbs.append(rms_db)
			
			if ref_durations:
				# Use reference characteristics or slider overrides
				target_min_duration = max(voice_sample_min_duration, min(ref_durations) * 0.8)
				target_max_duration = min(voice_sample_max_duration, max(ref_durations) * 1.2)
				target_min_rms = max(voice_sample_min_rms_db, min(ref_rms_dbs) - 3)
				
				emit(f"Reference characteristics: duration {target_min_duration:.1f}-{target_max_duration:.1f}s, RMS ≥{target_min_rms:.1f} dB")
				
				# Find similar segments
				candidates = [
					seg for seg in segments
					if target_min_duration <= seg.duration <= target_max_duration
					and seg.rms_db >= target_min_rms
				]
				candidates = sorted(candidates, key=lambda s: (s.duration, s.rms_db), reverse=True)[:voice_sample_count]
				emit(f"Found {len(candidates)} similar segments")
				
				for idx, seg in enumerate(candidates):
					start_idx = max(0, int(seg.start * sr))
					end_idx = min(len(audio), int(min(seg.end, seg.start + voice_sample_max_sec) * sr))
					if end_idx <= start_idx:
						continue
					snip = _to_mono(audio[start_idx:end_idx].copy())
					if snip.size == 0:
						continue
					target = voice_samples_dir / f"voice_sample_{idx:02d}.wav"
					sf.write(str(target), snip.astype(np.float32), sr)
					voice_samples.append(
						{
							"start": seg.start,
							"end": seg.end,
							"duration": seg.duration,
							"rmsDb": seg.rms_db,
							"path": target,
						}
					)
		elif manual_samples:
			# Extract manual samples directly (no similarity search)
			for idx, sample_spec in enumerate(manual_samples):
				start_sec = sample_spec.get("start", 0.0)
				end_sec = sample_spec.get("end", 0.0)
				start_idx = max(0, int(start_sec * sr))
				end_idx = min(len(audio), int(end_sec * sr))
				if end_idx <= start_idx:
					continue
				snip = _to_mono(audio[start_idx:end_idx].copy())
				if snip.size == 0:
					continue
				rms = float(np.sqrt(np.mean(snip**2)))
				rms_db = 20 * np.log10(rms + 1e-10)
				target = voice_samples_dir / f"voice_sample_{idx:02d}.wav"
				sf.write(str(target), snip.astype(np.float32), sr)
				voice_samples.append(
					{
						"start": start_sec,
						"end": end_sec,
						"duration": end_sec - start_sec,
						"rmsDb": float(rms_db),
						"path": target,
					}
				)
		elif voice_sample_count > 0:
			# Auto-generate samples from top segments with filters
			candidates = [
				seg for seg in segments
				if voice_sample_min_duration <= seg.duration <= voice_sample_max_duration
				and seg.rms_db >= voice_sample_min_rms_db
			]
			# Sort by duration first (prefer longer), then by RMS (prefer louder)
			candidates = sorted(candidates, key=lambda s: (s.duration, s.rms_db), reverse=True)[:voice_sample_count]
			for idx, seg in enumerate(candidates):
				start_idx = max(0, int(seg.start * sr))
				end_idx = min(len(audio), int(min(seg.end, seg.start + voice_sample_max_sec) * sr))
				if end_idx <= start_idx:
					continue
				snip = _to_mono(audio[start_idx:end_idx].copy())
				if snip.size == 0:
					continue
				target = voice_samples_dir / f"voice_sample_{idx:02d}.wav"
				sf.write(str(target), snip.astype(np.float32), sr)
				voice_samples.append(
					{
						"start": seg.start,
						"end": seg.end,
						"duration": seg.duration,
						"rmsDb": seg.rms_db,
						"path": target,
					}
				)

	return clean_path, manifest_path, preview_path, segments, sr, PREVIEW_SAMPLE_RATE, log, settings, voice_samples


def run_sanitize_job(
	vod_url: str,
	out_root: Path,
	dataset_root: Path,
	settings: SanitizeSettings | None = None,
	auto: bool = False,
	voice_samples: bool = False,
	voice_sample_count: int = 5,
	voice_sample_min_duration: float = 2.0,
	voice_sample_max_duration: float = 6.0,
	voice_sample_min_rms_db: float = -35.0,
	manual_samples: List[Dict] | None = None,
) -> Tuple[Path, Path, Path, List[Segment], int, int, List[str], SanitizeSettings, List[Dict]]:
	settings = settings or SanitizeSettings()

	_, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
	vod_slug = vod_dir.name
	input_audio = vod_dir / f"{vod_slug}_full.wav"
	clean_path = vod_dir / f"{vod_slug}_clean.wav"
	manifest_path = dataset_dir / f"{vod_slug}_segments.json"
	voice_samples_dir = dataset_dir / "voice_samples"

	return sanitize_audio(
		input_audio,
		clean_path,
		manifest_path,
		settings,
		auto=auto,
		voice_samples_dir=voice_samples_dir if (voice_samples or manual_samples) else None,
		voice_sample_count=voice_sample_count if voice_samples else 0,
		voice_sample_min_duration=voice_sample_min_duration,
		voice_sample_max_duration=voice_sample_max_duration,
		voice_sample_min_rms_db=voice_sample_min_rms_db,
		manual_samples=manual_samples,
	)
