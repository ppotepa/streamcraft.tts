from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import soundfile as sf

from streamcraft.core.dataset import parse_srt


@dataclass
class DatasetBuildResult:
    clips_dir: Path
    manifest_jsonl: Path
    segments_json: Path
    exported_count: int


def _load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _segment_score(segment: Dict[str, Any]) -> float:
    quality = float(segment.get("quality") or 0.0) / 100.0
    snr = max(0.0, float(segment.get("snr_db") or 0.0)) / 30.0
    speech = max(0.0, min(1.0, float(segment.get("speech_ratio") or 0.0)))
    clip_penalty = 1.0 - max(0.0, float(segment.get("clip_ratio") or 0.0))
    sfx_penalty = 1.0 - max(0.0, min(1.0, float(segment.get("sfx_score") or 0.0)))
    speaker_sim = max(0.0, min(1.0, float(segment.get("speaker_sim") or 0.0)))
    return 0.30 * quality + 0.20 * snr + 0.15 * speech + 0.15 * clip_penalty + 0.10 * sfx_penalty + 0.10 * speaker_sim


def _collect_accepted_segments(segments: List[Dict[str, Any]], review_payload: Optional[Dict[str, Any]]) -> List[int]:
    kept_indices = {idx for idx, seg in enumerate(segments) if bool(seg.get("kept"))}
    if not kept_indices:
        return []

    accepted = set(kept_indices)
    if review_payload:
        for vote in review_payload.get("votes") or []:
            idx = vote.get("index")
            decision = vote.get("decision")
            if not isinstance(idx, int) or idx not in kept_indices:
                continue
            if decision == "reject":
                accepted.discard(idx)
            elif decision == "accept":
                accepted.add(idx)

    return sorted(accepted)


def _text_overlap(cues, start: float, end: float) -> str:
    chunks: List[str] = []
    for cue in cues:
        overlap_start = max(start, cue.start)
        overlap_end = min(end, cue.end)
        if overlap_end <= overlap_start:
            continue
        if (overlap_end - overlap_start) / max(1e-6, cue.end - cue.start) < 0.25:
            continue
        if cue.text:
            chunks.append(cue.text.strip())
    return " ".join(chunks).strip()


def _segment_speaker_label(labels_payload: Dict[str, Any], start: float, end: float) -> Optional[str]:
    segments = labels_payload.get("segments") or []
    best_label = None
    best_overlap = 0.0
    for item in segments:
        speaker = item.get("speaker")
        if not speaker:
            continue
        s = float(item.get("start") or 0.0)
        e = float(item.get("end") or s)
        overlap = max(0.0, min(end, e) - max(start, s))
        if overlap > best_overlap:
            best_overlap = overlap
            best_label = str(speaker)
    return best_label


def _resolve_target_speaker(labels_payload: Dict[str, Any], accepted_indices: List[int], segments: List[Dict[str, Any]]) -> Optional[str]:
    totals: Dict[str, float] = {}
    for idx in accepted_indices:
        seg = segments[idx]
        start = float(seg.get("start") or 0.0)
        end = float(seg.get("end") or start)
        label = _segment_speaker_label(labels_payload, start, end)
        if not label:
            continue
        totals[label] = totals.get(label, 0.0) + max(0.0, end - start)
    if not totals:
        return None
    return max(totals.items(), key=lambda row: row[1])[0]


def build_dataset_from_run(
    *,
    run_dir: Path,
    vod_slug: str,
    clean_audio_path: Path,
    sanitize_manifest_path: Path,
    review_path: Optional[Path],
    asr_srt_path: Path,
    diarization_labels_path: Optional[Path] = None,
    target_speaker: Optional[str] = None,
    max_clip_sec: float = 12.0,
    min_text_chars: int = 3,
    min_speaker_sim: float = 0.0,
    force: bool = False,
) -> DatasetBuildResult:
    clips_dir = run_dir / "clips"
    manifest_jsonl = run_dir / "manifest.jsonl"
    segments_json = run_dir / "dataset_segments.json"

    if manifest_jsonl.exists() and not force:
        raise RuntimeError("Dataset already built for this run; rerun with force=true to rebuild")

    if clips_dir.exists() and force:
        for item in clips_dir.glob("*"):
            if item.is_file():
                item.unlink(missing_ok=True)
    clips_dir.mkdir(parents=True, exist_ok=True)

    manifest_payload = _load_json(sanitize_manifest_path)
    segments = manifest_payload.get("segments") or []
    review_payload = _load_json(review_path) if review_path and review_path.exists() else None

    accepted_indices = _collect_accepted_segments(segments, review_payload)
    if min_speaker_sim > 0:
        accepted_indices = [
            idx for idx in accepted_indices
            if float((segments[idx] or {}).get("speaker_sim") or 0.0) >= min_speaker_sim
        ]

    if diarization_labels_path and diarization_labels_path.exists():
        try:
            labels_payload = _load_json(diarization_labels_path)
            expected_speaker = target_speaker or labels_payload.get("targetSpeaker")
            if not expected_speaker:
                expected_speaker = _resolve_target_speaker(labels_payload, accepted_indices, segments)
            if expected_speaker:
                accepted_indices = [
                    idx
                    for idx in accepted_indices
                    if _segment_speaker_label(
                        labels_payload,
                        float((segments[idx] or {}).get("start") or 0.0),
                        float((segments[idx] or {}).get("end") or 0.0),
                    )
                    == expected_speaker
                ]
        except Exception:
            pass
    if not accepted_indices:
        manifest_jsonl.write_text("", encoding="utf-8")
        segments_json.write_text("[]", encoding="utf-8")
        return DatasetBuildResult(clips_dir=clips_dir, manifest_jsonl=manifest_jsonl, segments_json=segments_json, exported_count=0)

    if not clean_audio_path.exists():
        raise FileNotFoundError(f"Clean audio missing: {clean_audio_path}")
    if not asr_srt_path.exists():
        raise FileNotFoundError(f"ASR SRT missing: {asr_srt_path}")

    cues = parse_srt(asr_srt_path)
    audio, sample_rate = sf.read(str(clean_audio_path), always_2d=False)

    records: List[Dict[str, Any]] = []
    clip_index = 0

    for seg_idx in accepted_indices:
        seg = segments[seg_idx]
        seg_start = float(seg.get("start") or 0.0)
        seg_end = float(seg.get("end") or seg_start)
        if seg_end <= seg_start:
            continue

        current = seg_start
        while current < seg_end:
            part_end = min(seg_end, current + max_clip_sec)
            text = _text_overlap(cues, current, part_end)
            if len(text.strip()) < min_text_chars:
                current = part_end
                continue

            start_sample = max(0, int(current * sample_rate))
            end_sample = min(len(audio), int(part_end * sample_rate))
            if end_sample <= start_sample:
                current = part_end
                continue

            clip_index += 1
            clip_name = f"{clip_index:06d}.wav"
            clip_path = clips_dir / clip_name
            sf.write(str(clip_path), audio[start_sample:end_sample], sample_rate)

            record = {
                "clip": clip_name,
                "start": current,
                "end": part_end,
                "duration": part_end - current,
                "text": text,
                "segmentIndex": seg_idx,
                "score": _segment_score(seg),
                "snrDb": seg.get("snr_db"),
                "speechRatio": seg.get("speech_ratio"),
                "clipRatio": seg.get("clip_ratio"),
                "sfxScore": seg.get("sfx_score"),
                "speakerSim": seg.get("speaker_sim"),
            }
            records.append(record)
            current = part_end

    with manifest_jsonl.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    segments_json.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")

    return DatasetBuildResult(
        clips_dir=clips_dir,
        manifest_jsonl=manifest_jsonl,
        segments_json=segments_json,
        exported_count=len(records),
    )
