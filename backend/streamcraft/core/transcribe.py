import json
import math
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from faster_whisper import WhisperModel


@dataclass
class Segment:
    """Holds transcribed segment data."""
    start: float
    end: float
    text: str


class LiveSubtitleWriter:
    """Streams subtitle outputs to disk so progress is never lost."""

    def __init__(self, srt_path: Optional[Path], vtt_path: Optional[Path], txt_path: Optional[Path]):
        self.srt_path = srt_path
        self.vtt_path = vtt_path
        self.txt_path = txt_path
        self._srt_handle = self._open_handle(srt_path)
        self._vtt_handle = self._open_handle(vtt_path)
        self._txt_handle = self._open_handle(txt_path)
        self._counter = 0
        self._txt_written = False

        if self._vtt_handle:
            self._vtt_handle.write("WEBVTT\n\n")
            self._vtt_handle.flush()

    @staticmethod
    def _open_handle(path: Optional[Path]):
        if not path:
            return None
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.open("w", encoding="utf-8", newline="\n")

    def write_segment(self, seg: Segment):
        self._counter += 1
        start = format_timestamp(seg.start)
        end = format_timestamp(seg.end)
        text = seg.text

        if self._srt_handle:
            block = f"{self._counter}\n{start} --> {end}\n{text}\n\n"
            self._srt_handle.write(block)
            self._srt_handle.flush()

        if self._vtt_handle:
            vtt_start = start.replace(",", ".")
            vtt_end = end.replace(",", ".")
            block = f"{vtt_start} --> {vtt_end}\n{text}\n\n"
            self._vtt_handle.write(block)
            self._vtt_handle.flush()

        if self._txt_handle:
            if self._txt_written:
                self._txt_handle.write(" ")
            self._txt_handle.write(text)
            self._txt_handle.flush()
            self._txt_written = True

    def close(self):
        for handle in (self._srt_handle, self._vtt_handle, self._txt_handle):
            if handle:
                handle.flush()
                handle.close()

    @property
    def has_srt(self) -> bool:
        return self._srt_handle is not None

    @property
    def has_vtt(self) -> bool:
        return self._vtt_handle is not None

    @property
    def has_txt(self) -> bool:
        return self._txt_handle is not None


def log(msg: str):
    print(f"[i] {msg}")


def log_ok(msg: str):
    print(f"[OK] {msg}")


def log_warn(msg: str):
    print(f"[!] {msg}")


def ensure_ffmpeg() -> None:
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg not found. Install via winget install Gyan.FFmpeg or choco install ffmpeg and ensure it's on PATH."
        )


def detect_device(device: str, compute_type: Optional[str]) -> Tuple[str, str]:
    """Pick CUDA as the only supported device and ensure it is actually available."""

    def _has_cuda():
        try:
            import ctranslate2
            # Try multiple methods to detect CUDA
            if hasattr(ctranslate2, 'get_cuda_device_count'):
                return ctranslate2.get_cuda_device_count() > 0
            elif hasattr(ctranslate2, 'has_cuda'):
                return ctranslate2.has_cuda()
            else:
                # Fallback: try to use cuda and catch exception
                try:
                    from faster_whisper import WhisperModel
                    # This will fail if CUDA not available
                    return True
                except Exception:
                    return False
        except Exception:
            return False

    has_cuda = _has_cuda()
    desired = device or "cuda"

    if desired != "cuda":
        raise RuntimeError("This pipeline now supports CUDA-only execution; remove custom --device values.")

    if not has_cuda:
        raise RuntimeError(
            "CUDA runtime not detected. Install the CUDA build of ctranslate2/faster-whisper or fix GPU drivers."
        )

    chosen_compute = compute_type or "float16"
    return "cuda", chosen_compute


def ensure_cuda_dlls_available():
    if os.name != "nt":
        return

    python_dir = Path(sys.executable).resolve().parent
    venv_root = python_dir.parent
    site_packages = venv_root / "Lib" / "site-packages"
    if not site_packages.exists():
        return

    candidates = [
        site_packages / "nvidia" / "cublas" / "bin",
        site_packages / "nvidia" / "cudnn" / "bin",
        site_packages / "nvidia" / "cuda_runtime" / "bin",
    ]

    added = []
    current_path = os.environ.get("PATH", "")
    for path in candidates:
        if path.exists():
            path_str = str(path)
            if path_str not in current_path:
                os.environ["PATH"] = f"{path_str};{current_path}" if current_path else path_str
                current_path = os.environ["PATH"]
                added.append(path_str)

    if added:
        log(f"Added CUDA DLLs to PATH: {', '.join(added)}")


def download_vod(url: str, out_dir: Path, quality: str = "audio_only", force: bool = False) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    m = re.search(r"(\d{6,})", url)
    base = m.group(1) if m else "vod"
    target = out_dir / f"{base}.mp4"
    if target.exists() and not force:
        log(f"[i] Reusing cached VOD {target}")
        return target
    cmd = [
        sys.executable,
        "-m",
        "twitchdl",
        "download",
        url,
        "-o",
        str(target),
        "--overwrite",
        "--quality",
        quality,
    ]
    log(f"Downloading VOD via twitchdl ({quality}) to {target}: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    if not target.exists():
        raise RuntimeError(f"twitchdl did not produce expected file: {target}")
    return target


def extract_audio(input_media: Path, out_dir: Path, force: bool = False) -> Tuple[Path, Path]:
    """Produce a high-quality (48 kHz stereo) WAV used for both slicing and transcription."""

    base = input_media.stem
    full_path = out_dir / f"{base}_full.wav"

    if force or not full_path.exists():
        cmd_full = [
            "ffmpeg",
            "-y",
            "-i",
            str(input_media),
            "-vn",
            "-ac",
            "2",
            "-ar",
            "48000",
            "-c:a",
            "pcm_s16le",
            str(full_path),
        ]
        log(f"Extracting high-quality audio: {' '.join(cmd_full)}")
        subprocess.run(cmd_full, check=True)
    else:
        log(f"[i] Reusing high-quality audio {full_path}")

    # Return the same high-fidelity path for both dataset slicing and transcription inputs.
    return full_path, full_path


def format_timestamp(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    hrs, rem = divmod(ms, 3600 * 1000)
    mins, rem = divmod(rem, 60 * 1000)
    secs, ms = divmod(rem, 1000)
    return f"{hrs:02}:{mins:02}:{secs:02},{ms:03}"


def write_srt(segments, path: Path):
    lines = []
    for idx, seg in enumerate(segments, 1):
        start = format_timestamp(seg.start)
        end = format_timestamp(seg.end)
        text = (seg.text or "").strip()
        lines.append(str(idx))
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_vtt(segments, path: Path):
    lines = ["WEBVTT", ""]
    for seg in segments:
        start = format_timestamp(seg.start).replace(",", ".")
        end = format_timestamp(seg.end).replace(",", ".")
        text = (seg.text or "").strip()
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_txt(segments, path: Path):
    text = " ".join((seg.text or "").strip() for seg in segments)
    path.write_text(text, encoding="utf-8")

def transcribe(
    audio_path: Path,
    model_size: str,
    language: str,
    threads: int,
    device: str,
    compute_type: Optional[str],
    progress_interval: float,
    live_writer: Optional[LiveSubtitleWriter] = None,
    max_duration: Optional[float] = None,
):
    device, compute_type = detect_device(device, compute_type)
    if device == "cuda":
        ensure_cuda_dlls_available()
    log(f"Loading faster-whisper model={model_size} device={device} compute_type={compute_type} threads={threads}")
    model = WhisperModel(model_size, device=device, compute_type=compute_type, cpu_threads=threads)

    segments, info = model.transcribe(
        str(audio_path),
        language=None if language == "auto" else language,
        vad_filter=True,
        beam_size=5,
        best_of=5,
        patience=1,
        word_timestamps=True,
    )

    total = info.duration or 0.0
    limit = max_duration if max_duration and max_duration > 0 else None
    seen = 0.0
    last_emit = 0.0
    seg_list = []

    print("\n" + "="*80)
    print(f"{'TIMESTAMP':<20} | MESSAGE")
    print("="*80)

    for seg in segments:
        cleaned = (seg.text or "").strip()
        segment = Segment(start=seg.start, end=seg.end, text=cleaned)
        seg_list.append(segment)

        if live_writer:
            live_writer.write_segment(segment)
        
        # Format timestamp range
        start_ts = format_timestamp(seg.start)
        end_ts = format_timestamp(seg.end)
        timestamp = f"{start_ts} -> {end_ts}"
        
        # Print segment in real-time
        print(f"{timestamp:<20} | {cleaned}")

        if limit is not None and seg.end >= limit:
            log_warn(f"Reached max-duration limit ({limit:.1f}s); stopping early")
            break
        
        if total > 0:
            seen = seg.end
            if seen - last_emit >= progress_interval or seen >= total:
                pct = min(100.0, seen / total * 100.0)
                print(f"[progress] {seen:8.1f}s / {total:8.1f}s ({pct:5.1f}%)", flush=True)
                last_emit = seen

    print("="*80)
    log_ok(f"Transcribed {len(seg_list)} segments")
    processed = seg_list[-1].end if seg_list else 0.0
    meta = {
        "language": info.language,
        "duration": info.duration,
        "processed_duration": processed,
        "device": device,
        "compute_type": compute_type,
        "segments": len(seg_list),
    }
    return seg_list, meta


def save_metadata(meta: Dict, path: Path):
    path.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def run_transcription(
    vod: str,
    out_dir: Path,
    model: str,
    language: str,
    threads: int,
    device: str,
    compute_type: Optional[str],
    progress_interval: float,
    vod_quality: str,
    mux_subs: bool,
    also_vtt: bool,
    also_txt: bool,
    force: bool,
    max_duration: Optional[float],
):
    out_dir.mkdir(parents=True, exist_ok=True)

    if vod.startswith("http"):
        media_path = download_vod(vod, out_dir, quality=vod_quality, force=force)
    else:
        media_path = Path(vod).expanduser().resolve()
        if not media_path.exists():
            raise FileNotFoundError(f"Media file not found: {media_path}")

    audio_full_path, audio_path = extract_audio(media_path, out_dir, force=force)

    srt_path = out_dir / f"{media_path.stem}.srt"
    vtt_path = out_dir / f"{media_path.stem}.vtt"
    txt_path = out_dir / f"{media_path.stem}.txt"
    meta_path = out_dir / f"{media_path.stem}.meta.json"

    def cleanup_partial_outputs():
        for path in (srt_path, vtt_path, txt_path):
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass

    def run_once(run_device: str, run_compute: Optional[str]):
        writer = LiveSubtitleWriter(
            srt_path=srt_path,
            vtt_path=vtt_path if also_vtt else None,
            txt_path=txt_path if also_txt else None,
        )
        try:
            segments, meta = transcribe(
                audio_path,
                model,
                language,
                threads,
                run_device,
                run_compute,
                progress_interval,
                live_writer=writer,
                max_duration=max_duration,
            )
            return segments, meta, writer
        except Exception:
            writer.close()
            raise

    if not force and srt_path.exists():
        log_warn(f"SRT exists, skipping transcription: {srt_path}")
    else:
        writer = None
        try:
            segments, meta, writer = run_once(device, compute_type)
        except Exception:
            cleanup_partial_outputs()
            raise
        finally:
            if writer:
                writer.close()

        if not writer.has_srt:
            write_srt(segments, srt_path)
        meta["srt"] = str(srt_path)

        if also_vtt:
            if not writer.has_vtt:
                write_vtt(segments, vtt_path)
            meta["vtt"] = str(vtt_path)

        if also_txt:
            if not writer.has_txt:
                write_txt(segments, txt_path)
            meta["txt"] = str(txt_path)

        meta["audio"] = str(audio_path)
        meta["audio_full"] = str(audio_full_path)
        meta["media"] = str(media_path)
        save_metadata(meta, meta_path)
        log_ok(f"Saved SRT to {srt_path}")

    if mux_subs:
        subbed = out_dir / f"{media_path.stem}_subbed.mp4"
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(media_path),
            "-i",
            str(srt_path),
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-c:s",
            "mov_text",
            str(subbed),
        ]
        log(f"Muxing subs: {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        log_ok(f"Muxed to {subbed}")

    return {
        "media": str(media_path),
        "audio": str(audio_path),
        "audio_full": str(audio_full_path),
        "srt": str(srt_path),
        "out_dir": str(out_dir),
    }
