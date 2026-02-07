import csv
import json
import math
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import numpy as np
import soundfile as sf


def log(msg: str):
    print(f"[i] {msg}")


def log_ok(msg: str):
    print(f"[OK] {msg}")


def log_warn(msg: str):
    print(f"[!] {msg}")


@dataclass
class Cue:
    start: float
    end: float
    text: str


def parse_srt(path: Path) -> List[Cue]:
    import re

    content = path.read_text(encoding="utf-8", errors="ignore")
    blocks = re.split(r"\n\s*\n", content.strip())
    cues: List[Cue] = []
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 2:
            continue
        # skip index if present
        if lines[0].strip().isdigit():
            lines = lines[1:]
        if not lines:
            continue
        times = lines[0]
        m = re.match(r"(\d\d:\d\d:\d\d,\d\d\d)\s*-->\s*(\d\d:\d\d:\d\d,\d\d\d)", times)
        if not m:
            continue
        start = parse_ts(m.group(1))
        end = parse_ts(m.group(2))
        text = " ".join(lines[1:]).strip()
        cues.append(Cue(start, end, text))
    return cues


def parse_ts(ts: str) -> float:
    h, m, rest = ts.split(":")
    s, ms = rest.split(",")
    total_ms = (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)
    return total_ms / 1000.0


def slice_clip_pcm(source: Path, start: float, end: float, dst: Path):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ss",
        f"{start:.3f}",
        "-to",
        f"{end:.3f}",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(dst),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def slice_clip_aac(source: Path, start: float, end: float, dst: Path, bitrate_kbps: int):
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-ss",
        f"{start:.3f}",
        "-to",
        f"{end:.3f}",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "aac",
        "-b:a",
        f"{bitrate_kbps}k",
        "-movflags",
        "+faststart",
        str(dst),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def rms_db(wav_path: Path) -> float:
    audio, sr = sf.read(wav_path)
    if audio.size == 0:
        return -120.0
    rms = np.sqrt(np.mean(np.square(audio)))
    if rms <= 1e-9:
        return -120.0
    return 20 * math.log10(rms)


def run_demucs(input_audio: Path, out_dir: Path) -> Path:
    vocals_dir = out_dir / "demucs"
    vocals_dir.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-o", str(vocals_dir), str(input_audio)]
    log(f"Running demucs: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    # demucs outputs folder named after model; pick newest wav in tree
    candidates = sorted(vocals_dir.rglob("*vocals*.wav"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("Demucs did not produce vocals stem")
    return candidates[0]


def run_dataset(
    input_audio: Path,
    srt_path: Path,
    out_dir: Path,
    use_demucs: bool,
    min_speech_ms: int,
    max_clip_sec: int,
    pad_ms: int,
    merge_gap_ms: int,
    min_rms_db: Optional[float],
    threads: int,
    force: bool,
    clip_aac: bool,
    clip_aac_bitrate: int,
):
    out_dir.mkdir(parents=True, exist_ok=True)
    clips_dir = out_dir / "clips"
    clips_dir.mkdir(exist_ok=True)
    manifest_path = out_dir / "manifest.csv"
    segments_path = out_dir / "segments.json"

    existing_ids = set()
    for pattern in ("*.wav", "*.m4a"):
        for p in clips_dir.glob(pattern):
            if p.stem.isdigit():
                existing_ids.add(int(p.stem))
    existing_ids = sorted(existing_ids)
    clip_offset = max(existing_ids) if existing_ids else 0

    # pick audio source
    source_audio = input_audio
    if use_demucs:
        source_audio = run_demucs(input_audio, out_dir)

    cues = parse_srt(srt_path)
    if not cues:
        raise RuntimeError("No cues parsed from SRT")

    # merge/normalize cues based on gaps and durations
    merged: List[Cue] = []
    for cue in cues:
        # basic gap merge
        if merged and cue.start - merged[-1].end <= merge_gap_ms / 1000.0:
            merged[-1].end = max(merged[-1].end, cue.end)
            merged[-1].text = (merged[-1].text + " " + cue.text).strip()
        else:
            merged.append(cue)

    # apply min duration and padding
    final_segments = []
    for cue in merged:
        duration = cue.end - cue.start
        if duration * 1000 < min_speech_ms:
            continue
        start = max(0.0, cue.start - pad_ms / 1000.0)
        end = cue.end + pad_ms / 1000.0
        # split long clips
        if end - start > max_clip_sec:
            t = start
            while t < end:
                seg_end = min(end, t + max_clip_sec)
                text = cue.text  # keep same text for split chunks
                final_segments.append(Cue(t, seg_end, text))
                t = seg_end
        else:
            final_segments.append(Cue(start, end, cue.text))

    rows = []
    exported = []
    for idx, seg in enumerate(final_segments, 1):
        clip_id = clip_offset + idx
        clip_path = clips_dir / f"{clip_id:06d}.wav"
        clip_aac_path = clips_dir / f"{clip_id:06d}.m4a" if clip_aac else None

        if not force:
            if clip_path.exists() or (clip_aac_path and clip_aac_path.exists()):
                log_warn(f"Clip exists, skipping: {clip_path.name}")
                continue

        try:
            slice_clip_pcm(source_audio, seg.start, seg.end, clip_path)
            if clip_aac_path:
                slice_clip_aac(source_audio, seg.start, seg.end, clip_aac_path, clip_aac_bitrate)
        except subprocess.CalledProcessError as exc:
            clip_path.unlink(missing_ok=True)
            if clip_aac_path:
                clip_aac_path.unlink(missing_ok=True)
            raise exc

        if min_rms_db is not None:
            level = rms_db(clip_path)
            if level < min_rms_db:
                log_warn(f"Dropping clip {clip_path.name} RMS {level:.1f} dB < {min_rms_db}")
                clip_path.unlink(missing_ok=True)
                if clip_aac_path:
                    clip_aac_path.unlink(missing_ok=True)
                continue
        rows.append([clip_path.name, f"{seg.start:.3f}", f"{seg.end:.3f}", seg.text])
        exported.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text,
            "clip": clip_path.name,
            "clip_aac": clip_aac_path.name if clip_aac_path and clip_aac_path.exists() else None,
        })

    if rows:
        write_header = not manifest_path.exists() or manifest_path.stat().st_size == 0
        with manifest_path.open("a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(["clip", "start_sec", "end_sec", "text"])
            writer.writerows(rows)

    existing_segments: List[dict] = []
    if segments_path.exists():
        try:
            existing_segments = json.loads(segments_path.read_text(encoding="utf-8"))
        except Exception:
            existing_segments = []
    existing_segments.extend(exported)
    segments_path.write_text(json.dumps(existing_segments, indent=2), encoding="utf-8")
    log_ok(f"Exported {len(rows)} new clips to {clips_dir}")
    return {
        "manifest": str(manifest_path),
        "segments": str(segments_path),
        "clips": str(clips_dir),
        "source": str(source_audio),
    }
