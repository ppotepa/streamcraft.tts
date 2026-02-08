"""Sanitize v2: VAD + quality-scored segmentation with preview support.

This module implements a smarter sanitization pipeline:
- Frame-level analysis using VAD (webrtcvad) and energy features
- Keep-mask with hysteresis + hangover to avoid mid-word cuts
- Segment scoring (speech ratio, SNR, clipping, SFX penalty, optional speaker sim placeholder)
- Presets + strictness mapping
- Preview or full runs with manifest rich diagnostics
- Simple loudness normalization to target LUFS-ish + true-peak limiting

Note: Speaker similarity is stubbed (0.5) until a voice embedding model is integrated.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import soundfile as sf
import webrtcvad

from streamcraft.core.pipeline import resolve_output_dirs
from streamcraft.core.sanitize import _apply_fade, _clamp, _resample_linear, _to_mono

PREVIEW_SAMPLE_RATE = 24000
VAD_SAMPLE_RATE = 16000


class SanitiseMode(str, Enum):
	AUTO = "auto"
	VOICE = "voice"


class SanitisePreset(str, Enum):
	STRICT = "strict"
	BALANCED = "balanced"
	LENIENT = "lenient"


@dataclass
class SanitiseConfig:
	mode: SanitiseMode = SanitiseMode.AUTO
	preset: SanitisePreset = SanitisePreset.BALANCED
	strictness: float = 0.5  # 0..1 (0 = keep more, 1 = cleaner)
	preview: bool = False
	preview_start: float = 0.0
	preview_duration: float = 90.0  # seconds
	voice_sample_count: int = 8
	voice_sample_min_duration: float = 2.0
	voice_sample_max_duration: float = 6.0
	voice_sample_min_rms_db: float = -35.0
	manual_samples: Optional[List[Dict]] = None
	preserve_pauses: bool = True
	reduce_sfx: bool = True
	target_lufs: float = -18.0
	true_peak_limit_db: float = -1.0
	fade_ms: int = 12


@dataclass
class FrameFeatures:
	rms_db: np.ndarray  # shape (n,)
	vad_prob: np.ndarray
	noise_floor_db: float
	sfx_score: np.ndarray
	speaker_sim: Optional[np.ndarray] = None


@dataclass
class SegmentDiagnostics:
	start: float
	end: float
	quality: int
	speech_ratio: float
	snr_db: float
	clip_ratio: float
	sfx_score: float
	speaker_sim: float
	kept: bool
	reject_reason: List[str]
	labels: List[str]

	@property
	def duration(self) -> float:
		return max(0.0, self.end - self.start)


@dataclass
class SanitiseResult:
	clean_path: Path
	manifest_path: Path
	preview_path: Path
	segments: List[SegmentDiagnostics]
	preview_sr: int
	params: Dict[str, float]
	voice_samples: List[Dict]
	log: List[str]


# ---------------- Preset mapping -----------------


def _preset_baseline(preset: SanitisePreset) -> Dict[str, float]:
	if preset == SanitisePreset.STRICT:
		return {
			"speechProbThreshold": 0.75,
			"qualityMinScore": 75,
			"minSegmentMs": 900,
			"minSilenceMsToSplit": 220,
			"hangoverMs": 220,
			"preRollMs": 80,
			"postRollMs": 220,
			"sfxPenaltyStrength": 1.2,
			"frameKeep": 0.60,
		}
	if preset == SanitisePreset.LENIENT:
		return {
			"speechProbThreshold": 0.55,
			"qualityMinScore": 45,
			"minSegmentMs": 450,
			"minSilenceMsToSplit": 320,
			"hangoverMs": 180,
			"preRollMs": 60,
			"postRollMs": 180,
			"sfxPenaltyStrength": 0.8,
			"frameKeep": 0.50,
		}
	return {
		"speechProbThreshold": 0.65,
		"qualityMinScore": 60,
		"minSegmentMs": 650,
		"minSilenceMsToSplit": 260,
		"hangoverMs": 200,
		"preRollMs": 80,
		"postRollMs": 200,
		"sfxPenaltyStrength": 1.0,
		"frameKeep": 0.55,
	}


def _apply_strictness(base: Dict[str, float], s: float) -> Dict[str, float]:
	# s in [0,1]; higher = cleaner
	return {
		"speechProbThreshold": base["speechProbThreshold"] + 0.12 * s,
		"qualityMinScore": base["qualityMinScore"] + 20.0 * s,
		"minSegmentMs": base["minSegmentMs"] + 500.0 * s,
		"minSilenceMsToSplit": base["minSilenceMsToSplit"] + 80.0 * s,
		"hangoverMs": base["hangoverMs"] + 60.0 * s,
		"preRollMs": base["preRollMs"],
		"postRollMs": base["postRollMs"],
		"sfxPenaltyStrength": base["sfxPenaltyStrength"] + 0.4 * s,
		"frameKeep": base["frameKeep"] + 0.1 * s,
	}


# ---------------- Audio helpers -----------------


def _load_audio(path: Path) -> Tuple[np.ndarray, int]:
	data, sr = sf.read(str(path), always_2d=False)
	if data.dtype != np.float32:
		data = data.astype(np.float32)
	return data, int(sr)


def _ensure_mono(audio: np.ndarray) -> np.ndarray:
	return audio if audio.ndim == 1 else audio.mean(axis=1)


def _resample_simple(audio: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
	if src_sr == dst_sr:
		return audio.copy()
	duration = len(audio) / src_sr
	dst_len = max(1, int(round(duration * dst_sr)))
	src_x = np.linspace(0.0, duration, num=len(audio), endpoint=False)
	dst_x = np.linspace(0.0, duration, num=dst_len, endpoint=False)
	return np.interp(dst_x, src_x, audio).astype(np.float32)


# ---------------- Feature extraction -----------------


def _frame_audio(audio: np.ndarray, frame_samples: int) -> np.ndarray:
	total = len(audio) // frame_samples
	if total == 0:
		return np.empty((0, frame_samples), dtype=np.float32)
	trimmed = audio[: total * frame_samples]
	return trimmed.reshape(total, frame_samples)


def _rms_db(frames: np.ndarray) -> np.ndarray:
	if frames.size == 0:
		return np.array([], dtype=np.float32)
	rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
	return 20 * np.log10(rms + 1e-12)


def _sfx_score(frames: np.ndarray) -> np.ndarray:
	# Simple transient detector: normalized absolute diff between consecutive frame RMS
	if len(frames) == 0:
		return np.array([], dtype=np.float32)
	rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
	diff = np.abs(np.diff(rms, prepend=rms[:1]))
	max_rms = np.maximum(rms, 1e-6)
	score = diff / max_rms
	return np.clip(score, 0.0, 1.0).astype(np.float32)


def _vad_prob(frames: np.ndarray, vad: webrtcvad.Vad) -> np.ndarray:
	if len(frames) == 0:
		return np.array([], dtype=np.float32)
	# webrtcvad expects 16k 16-bit mono PCM
	probs = []
	for f in frames:
		pcm16 = np.clip(f * 32768.0, -32768, 32767).astype(np.int16).tobytes()
		probs.append(1.0 if vad.is_speech(pcm16, VAD_SAMPLE_RATE) else 0.0)
	probs = np.array(probs, dtype=np.float32)
	# Smooth to act like probability
	if probs.size >= 3:
		kernel = np.ones(3, dtype=np.float32) / 3.0
		probs = np.convolve(probs, kernel, mode="same")
	return probs


def extract_features(audio: np.ndarray, sr: int, cfg: SanitiseConfig) -> FrameFeatures:
	mono = _ensure_mono(audio)
	mono_16k = _resample_simple(mono, sr, VAD_SAMPLE_RATE)
	frame_ms = 20
	frame_samples = int(VAD_SAMPLE_RATE * frame_ms / 1000)
	frames = _frame_audio(mono_16k, frame_samples)
	rms_db = _rms_db(frames)
	noise_floor_db = float(np.percentile(rms_db, 15)) if rms_db.size else -60.0
	sfx = _sfx_score(frames)
	vad = webrtcvad.Vad(2 if cfg.preset == SanitisePreset.STRICT else 1)
	vad_prob = _vad_prob(frames, vad)

	# Placeholder speaker similarity until embeddings are integrated
	speaker_sim = None
	if cfg.mode == SanitiseMode.VOICE:
		speaker_sim = np.full_like(vad_prob, 0.5)

	return FrameFeatures(
		rms_db=rms_db,
		vad_prob=vad_prob,
		noise_floor_db=noise_floor_db,
		sfx_score=sfx,
		speaker_sim=speaker_sim,
	)


# ---------------- Keep mask & segments -----------------


def _build_keep_mask(features: FrameFeatures, params: Dict[str, float], cfg: SanitiseConfig) -> np.ndarray:
	if features.vad_prob.size == 0:
		return np.array([], dtype=bool)

	vad = features.vad_prob
	energy_above_noise = features.rms_db - features.noise_floor_db
	energy_ok = np.clip((energy_above_noise - 6.0) / 12.0, 0.0, 1.0)
	sfx_penalty = features.sfx_score * (params["sfxPenaltyStrength"] if cfg.reduce_sfx else 0.5)

	quality_frame = 0.55 * vad + 0.25 * energy_ok - 0.20 * sfx_penalty
	if cfg.mode == SanitiseMode.VOICE and features.speaker_sim is not None:
		quality_frame += 0.35 * features.speaker_sim
		quality_frame -= 0.20 * (1.0 - features.speaker_sim)

	frame_keep = params.get("frameKeep", 0.55)
	start_keep = frame_keep + 0.05
	stop_keep = frame_keep - 0.05

	mask = np.zeros_like(quality_frame, dtype=bool)
	active = False
	hang_ms = params["hangoverMs"]
	hang_frames = max(1, int(hang_ms / 20))
	hang_count = 0
	for i, q in enumerate(quality_frame):
		if active:
			if q >= stop_keep:
				mask[i] = True
				hang_count = 0
			else:
				hang_count += 1
				if hang_count <= hang_frames:
					mask[i] = True
				else:
					active = False
		else:
			if q >= start_keep:
				active = True
				mask[i] = True
	return mask


def _mask_to_segments(mask: np.ndarray, params: Dict[str, float], total_frames: int) -> List[Tuple[int, int]]:
	segments: List[Tuple[int, int]] = []
	start = None
	min_frames = max(1, int(params["minSegmentMs"] / 20))
	min_silence_split = max(1, int(params["minSilenceMsToSplit"] / 20))

	silence_run = 0
	for idx, keep in enumerate(mask):
		if keep:
			if start is None:
				start = idx
			silence_run = 0
		else:
			if start is not None:
				silence_run += 1
				if silence_run >= min_silence_split:
					end = idx - silence_run
					if end - start >= min_frames:
						segments.append((start, end))
					start = None
					silence_run = 0
	if start is not None:
		segments.append((start, total_frames))
	return segments


def _apply_preroll_postroll(segments: List[Tuple[int, int]], params: Dict[str, float], total_frames: int) -> List[Tuple[int, int]]:
	pre_frames = max(0, int(params["preRollMs"] / 20))
	post_frames = max(0, int(params["postRollMs"] / 20))
	out = []
	for s, e in segments:
		out.append((max(0, s - pre_frames), min(total_frames, e + post_frames)))
	return out


def _merge_segments(segments: List[Tuple[int, int]], params: Dict[str, float], preserve_pauses: bool) -> List[Tuple[int, int]]:
	if not segments:
		return []
	adaptive_gap = params["minSilenceMsToSplit"] if preserve_pauses else params["minSilenceMsToSplit"] * 0.6
	gap_frames = max(1, int(adaptive_gap / 20))
	merged: List[Tuple[int, int]] = []
	cur_s, cur_e = segments[0]
	for s, e in segments[1:]:
		if s - cur_e <= gap_frames:
			cur_e = e
		else:
			merged.append((cur_s, cur_e))
			cur_s, cur_e = s, e
	merged.append((cur_s, cur_e))
	return merged


# ---------------- Segment scoring -----------------


def _segment_quality(seg_audio: np.ndarray, features: FrameFeatures, frame_start: int, frame_end: int, params: Dict[str, float], cfg: SanitiseConfig) -> SegmentDiagnostics:
	frames_count = max(1, frame_end - frame_start)
	segment_frames = slice(frame_start, frame_end)

	speech_ratio = float(np.mean(features.vad_prob[segment_frames])) if frames_count else 0.0
	snr_db = float(np.mean(features.rms_db[segment_frames] - features.noise_floor_db)) if frames_count else -60.0
	clip_ratio = float(np.mean(np.abs(seg_audio) >= 0.999)) if seg_audio.size else 0.0
	sfx_score = float(np.mean(features.sfx_score[segment_frames])) if frames_count else 0.0
	speaker_sim = float(np.mean(features.speaker_sim[segment_frames])) if cfg.mode == SanitiseMode.VOICE and features.speaker_sim is not None else 0.5

	score = 0.0
	score += 40.0 * speech_ratio
	score += 25.0 * _clamp((snr_db - 6.0) / 12.0, 0.0, 1.0)
	score += 15.0 * (1.0 - clip_ratio)
	score += 10.0 * (1.0 - sfx_score)
	if cfg.mode == SanitiseMode.VOICE:
		score += 25.0 * speaker_sim

	quality = int(_clamp(score, 0.0, 100.0))
	labels: List[str] = []
	if quality >= 80:
		labels.append("excellent")
	elif quality >= 60:
		labels.append("good")
	elif quality >= 40:
		labels.append("borderline")
	else:
		labels.append("rejected")

	reject_reason: List[str] = []
	if quality < params["qualityMinScore"]:
		reject_reason.append("low_quality")
	if speech_ratio < 0.4:
		reject_reason.append("low_speech_prob")
	if sfx_score > 0.6:
		reject_reason.append("high_sfx")
	if clip_ratio > 0.02:
		reject_reason.append("clipping")

	start = frame_start * 0.02
	end = frame_end * 0.02
	kept = quality >= params["qualityMinScore"]

	return SegmentDiagnostics(
		start=start,
		end=end,
		quality=quality,
		speech_ratio=speech_ratio,
		snr_db=snr_db,
		clip_ratio=clip_ratio,
		sfx_score=sfx_score,
		speaker_sim=speaker_sim,
		kept=kept,
		reject_reason=reject_reason,
		labels=labels,
	)


# ---------------- Rendering -----------------


def _concat_kept(audio: np.ndarray, sr: int, segments: List[SegmentDiagnostics], cfg: SanitiseConfig) -> np.ndarray:
	mono = _ensure_mono(audio)
	pieces: List[np.ndarray] = []
	for seg in segments:
		if not seg.kept:
			continue
		start_idx = max(0, int(seg.start * sr))
		end_idx = min(len(mono), int(seg.end * sr))
		chunk = mono[start_idx:end_idx].copy()
		if chunk.size == 0:
			continue
		chunk = _apply_fade(chunk, sr, type("obj", (), {"fade_ms": cfg.fade_ms}))
		pieces.append(chunk)
	if not pieces:
		return np.array([], dtype=np.float32)
	return np.concatenate(pieces)


def _measure_rms_db(audio: np.ndarray) -> float:
	if audio.size == 0:
		return -80.0
	rms = float(np.sqrt(np.mean(audio * audio) + 1e-12))
	return 20 * math.log10(rms + 1e-12)


def _normalize_lufs_like(audio: np.ndarray, target_lufs: float, true_peak_db: float) -> np.ndarray:
	if audio.size == 0:
		return audio
	current = _measure_rms_db(audio)  # proxy for LUFS
	gain_db = target_lufs - current
	gain = math.pow(10.0, gain_db / 20.0)
	audio = audio * gain
	# True-peak limit (simple hard clip)
	peak_lin = math.pow(10.0, true_peak_db / 20.0)
	audio = np.clip(audio, -peak_lin, peak_lin)
	return audio.astype(np.float32)


# ---------------- Manifest -----------------


def _write_manifest(path: Path, sr: int, source: Path, cfg: SanitiseConfig, params: Dict[str, float], segments: List[SegmentDiagnostics]) -> None:
	payload = {
		"source": {
			"file": str(source),
			"sample_rate": sr,
		},
		"settings": {
			"preset": cfg.preset.value,
			"strictness": cfg.strictness,
			"mode": cfg.mode.value,
		},
		"segments": [
			{
				"start": seg.start,
				"end": seg.end,
				"dur": seg.duration,
				"kept": seg.kept,
				"quality": seg.quality,
				"speech_ratio": seg.speech_ratio,
				"snr_db": seg.snr_db,
				"clip_ratio": seg.clip_ratio,
				"sfx_score": seg.sfx_score,
				"speaker_sim": seg.speaker_sim,
				"labels": seg.labels,
				"reject_reason": seg.reject_reason,
			}
			for seg in segments
		],
	}
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


# ---------------- Voice samples selection -----------------


def _select_voice_samples(audio: np.ndarray, sr: int, segments: List[SegmentDiagnostics], cfg: SanitiseConfig) -> List[Dict]:
	kept = [s for s in segments if s.kept]
	candidates = [
		s for s in kept
		if cfg.voice_sample_min_duration <= s.duration <= cfg.voice_sample_max_duration
		and s.snr_db >= 6.0
		and s.quality >= 60
	]
	candidates = sorted(candidates, key=lambda s: (s.quality, s.snr_db), reverse=True)
	chosen: List[Dict] = []
	for idx, seg in enumerate(candidates[: cfg.voice_sample_count]):
		start_idx = max(0, int(seg.start * sr))
		end_idx = min(len(audio), int(seg.end * sr))
		chunk = audio[start_idx:end_idx]
		if chunk.size == 0:
			continue
		path = f"voice_samples/voice_sample_{idx:02d}.wav"
		chosen.append(
			{
				"start": seg.start,
				"end": seg.end,
				"duration": seg.duration,
				"rmsDb": float(_measure_rms_db(chunk)),
				"path": path,
			}
		)
	return chosen


# ---------------- Main entry -----------------


def run_sanitise_v2(
	vod_url: str,
	out_root: Path,
	dataset_root: Path,
	cfg: SanitiseConfig,
) -> SanitiseResult:
	log: List[str] = []

	_, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
	vod_slug = vod_dir.name
	input_audio = vod_dir / f"{vod_slug}_full.wav"
	clean_path = vod_dir / f"{vod_slug}_clean.wav"
	preview_path = vod_dir / f"{vod_slug}_preview.wav"
	manifest_path = dataset_dir / f"{vod_slug}_segments.json"

	if not input_audio.exists():
		raise FileNotFoundError(f"Missing input audio: {input_audio}")

	log.append(f"Loading audio {input_audio}")
	audio, sr = _load_audio(input_audio)
	log.append(f"Loaded waveform sr={sr} hz, duration={len(audio)/sr:.2f}s")

	if cfg.preview:
		start = max(0.0, cfg.preview_start)
		end = min(len(audio) / sr, start + cfg.preview_duration)
		start_idx = int(start * sr)
		end_idx = int(end * sr)
		log.append(f"Preview window: {start:.2f}s-{end:.2f}s")
		audio = audio[start_idx:end_idx]

	params = _apply_strictness(_preset_baseline(cfg.preset), cfg.strictness)

	features = extract_features(audio, sr, cfg)
	mask = _build_keep_mask(features, params, cfg)
	segments_idx = _mask_to_segments(mask, params, total_frames=len(features.vad_prob))
	segments_idx = _apply_preroll_postroll(segments_idx, params, len(features.vad_prob))
	segments_idx = _merge_segments(segments_idx, params, cfg.preserve_pauses)

	segments: List[SegmentDiagnostics] = []
	for s, e in segments_idx:
		start_t = s * 0.02
		end_t = e * 0.02
		seg_audio = audio[int(start_t * sr) : int(end_t * sr)]
		segments.append(_segment_quality(seg_audio, features, s, e, params, cfg))

	log.append(f"Detected {len(segments)} segments; kept {sum(1 for s in segments if s.kept)}")

	clean_audio = _concat_kept(audio, sr, segments, cfg)
	clean_audio = _normalize_lufs_like(clean_audio, cfg.target_lufs, cfg.true_peak_limit_db)

	if clean_audio.size == 0:
		raise ValueError("No speech retained after sanitization")

	clean_path.parent.mkdir(parents=True, exist_ok=True)
	sf.write(str(clean_path), clean_audio, sr)

	preview_audio = _resample_linear(clean_audio, sr, PREVIEW_SAMPLE_RATE)
	sf.write(str(preview_path), preview_audio, PREVIEW_SAMPLE_RATE)

	_write_manifest(manifest_path, sr, input_audio, cfg, params, segments)

	voice_samples = _select_voice_samples(audio, sr, segments, cfg) if cfg.mode == SanitiseMode.VOICE else []
	if voice_samples:
		vs_dir = dataset_dir / "voice_samples"
		vs_dir.mkdir(parents=True, exist_ok=True)
		for vs in voice_samples:
			start_idx = max(0, int(vs["start"] * sr))
			end_idx = min(len(audio), int(vs["end"] * sr))
			chunk = audio[start_idx:end_idx]
			sf.write(str(vs_dir / Path(vs["path"]).name), chunk, sr)

	return SanitiseResult(
		clean_path=clean_path,
		manifest_path=manifest_path,
		preview_path=preview_path,
		segments=segments,
		preview_sr=PREVIEW_SAMPLE_RATE,
		params=params,
		voice_samples=voice_samples,
		log=log,
	)
