import argparse
import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple

from .dataset import run_dataset
from .transcribe import run_transcription


def configure_temp_dir(base_dir: Path) -> Path:
    """Scope temp/cache folders to the repo so runs stay self-contained."""

    temp_dir = base_dir / "temp"
    cache_dir = temp_dir / "cache"
    temp_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    for key in ("TMPDIR", "TEMP", "TMP"):
        os.environ[key] = str(temp_dir)

    os.environ["LOCALAPPDATA"] = str(cache_dir)
    os.environ.setdefault("XDG_CACHE_HOME", str(cache_dir))
    os.environ.setdefault("HF_HOME", str(cache_dir / "hf"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", str(cache_dir / "hf"))
    os.environ.setdefault("CT2_HOME", str(cache_dir / "ct2"))

    return temp_dir


def slugify_label(value: Optional[str], fallback: str) -> str:
    if not value:
        return fallback
    cleaned = "".join(ch if ch.isalnum() else "-" for ch in value.lower())
    cleaned = cleaned.strip("-")
    return cleaned or fallback


def describe_vod(vod: str) -> Tuple[str, Optional[str]]:
    if not vod.startswith("http"):
        return "local", Path(vod).stem or "vod"

    try:
        from twitchdl import twitch, utils  # type: ignore

        vid = utils.parse_video_identifier(vod)
        if not vid:
            return "unknown", None
        video = twitch.get_video(vid) or {}
        owner = video.get("owner") or {}
        streamer = owner.get("login") or owner.get("displayName") or "unknown"
        return streamer, vid
    except Exception:
        return "unknown", None


def fallback_vod_slug(vod: str) -> str:
    if vod.startswith("http"):
        return hashlib.md5(vod.encode("utf-8")).hexdigest()[:12]
    return Path(vod).stem or "vod"


def resolve_output_dirs(vod: str, out_root: Path, dataset_root: Path) -> Tuple[str, Path, Path]:
    streamer, vod_identifier = describe_vod(vod)
    streamer_slug = slugify_label(streamer, "unknown")
    vod_slug = slugify_label(vod_identifier, fallback_vod_slug(vod))

    vod_dir = out_root / streamer_slug / "vods" / vod_slug
    dataset_dir = dataset_root / streamer_slug
    return streamer_slug or "unknown", vod_dir, dataset_dir


def parse_args():
    parser = argparse.ArgumentParser(
        description="One-click Twitch VOD → transcription → dataset tool (CUDA only)."
    )
    parser.add_argument("--vod", required=True, help="Twitch VOD URL or local media file path")
    parser.add_argument("--outdir", default="out", help="Base folder for VOD artifacts")
    parser.add_argument(
        "--dataset-out",
        default="dataset",
        help="Base folder for dataset clips (auto-grouped per streamer)",
    )
    parser.add_argument(
        "--model",
        default="large-v3",
        choices=["tiny", "base", "small", "medium", "large-v2", "large-v3"],
        help="faster-whisper checkpoint to use",
    )
    parser.add_argument("--language", default="en", help="ISO language code or 'auto'")
    parser.add_argument("--threads", type=int, default=8, help="CPU threads for the Whisper decoder")
    parser.add_argument(
        "--compute-type",
        default="float16",
        help="CUDA compute precision (float16, int8_float16, etc.)",
    )
    parser.add_argument(
        "--progress-interval", type=float, default=10.0, help="Seconds between progress updates"
    )
    parser.add_argument(
        "--vod-quality",
        choices=["chunked", "720p60", "480p", "360p", "160p", "audio_only"],
        default="audio_only",
        help="Quality label passed to twitchdl",
    )
    parser.add_argument("--max-duration", type=float, default=None, help="Stop transcription after N seconds")
    parser.add_argument("--mux-subs", action="store_true", help="Also mux the SRT into the MP4")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download + re-slice even if outputs already exist",
    )
    parser.add_argument("--use-demucs", action="store_true", help="Run Demucs to isolate vocals first")
    parser.add_argument("--min-speech-ms", type=int, default=1500)
    parser.add_argument("--max-clip-sec", type=int, default=12)
    parser.add_argument("--pad-ms", type=int, default=150)
    parser.add_argument("--merge-gap-ms", type=int, default=300)
    parser.add_argument("--min-rms-db", type=float, default=None)
    parser.add_argument("--ds-threads", type=int, default=4, help="FFmpeg threads for slicing")
    parser.add_argument(
        "--keep-existing-clips",
        action="store_true",
        help="Skip clips that already exist instead of overwriting them",
    )
    parser.add_argument(
        "--no-clip-aac",
        dest="clip_aac",
        action="store_false",
        help="Skip exporting AAC mirrors for each clip",
    )
    parser.add_argument("--clip-aac-bitrate", type=int, default=320)
    parser.set_defaults(clip_aac=True)
    return parser.parse_args()


def main():
    args = parse_args()
    configure_temp_dir(Path.cwd())

    streamer_slug, vod_dir, dataset_dir = resolve_output_dirs(args.vod, Path(args.outdir), Path(args.dataset_out))
    vod_dir.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    print(f"[i] Streamer bucket: {streamer_slug}")
    print(f"[i] VOD artifacts: {vod_dir}")
    print(f"[i] Dataset dir: {dataset_dir}")

    meta = run_transcription(
        vod=args.vod,
        out_dir=vod_dir,
        model=args.model,
        language=args.language,
        threads=args.threads,
        device="cuda",
        compute_type=args.compute_type,
        progress_interval=args.progress_interval,
        vod_quality=args.vod_quality,
        mux_subs=args.mux_subs,
        also_vtt=True,
        also_txt=True,
        force=args.force,
        max_duration=args.max_duration,
    )

    run_dataset(
        input_audio=Path(meta.get("audio_full") or meta["audio"]),
        srt_path=Path(meta["srt"]),
        out_dir=dataset_dir,
        use_demucs=args.use_demucs,
        min_speech_ms=args.min_speech_ms,
        max_clip_sec=args.max_clip_sec,
        pad_ms=args.pad_ms,
        merge_gap_ms=args.merge_gap_ms,
        min_rms_db=args.min_rms_db,
        threads=args.ds_threads,
        force=args.force or not args.keep_existing_clips,
        clip_aac=args.clip_aac,
        clip_aac_bitrate=args.clip_aac_bitrate,
    )


if __name__ == "__main__":
    main()
