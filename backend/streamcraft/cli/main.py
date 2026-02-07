"""CLI entrypoints."""

import os
from pathlib import Path

import typer

from streamcraft.core.pipeline import (
    configure_temp_dir,
    resolve_output_dirs,
    run_transcription,
)
from streamcraft.core.dataset import run_dataset
from streamcraft.settings import get_settings

app = typer.Typer(help="Streamcraft TTS CLI")


@app.command()
def pipeline(
    vod: str = typer.Option(..., "--vod", help="Twitch VOD URL or local media file"),
    outdir: str = typer.Option("out", "--outdir", help="Base folder for VOD artifacts"),
    dataset_out: str = typer.Option("dataset", "--dataset-out", help="Base folder for dataset clips"),
    model: str = typer.Option("large-v3", "--model", help="faster-whisper model"),
    language: str = typer.Option("en", "--language", help="ISO language code or 'auto'"),
    threads: int = typer.Option(8, "--threads", help="CPU threads for Whisper decoder"),
    compute_type: str = typer.Option("float16", "--compute-type", help="CUDA compute precision"),
    progress_interval: float = typer.Option(10.0, "--progress-interval", help="Seconds between progress updates"),
    vod_quality: str = typer.Option("audio_only", "--vod-quality", help="twitchdl quality"),
    max_duration: float = typer.Option(None, "--max-duration", help="Stop transcription after N seconds"),
    mux_subs: bool = typer.Option(False, "--mux-subs", help="Mux SRT into MP4"),
    force: bool = typer.Option(False, "--force", help="Re-download + re-slice"),
    use_demucs: bool = typer.Option(False, "--use-demucs", help="Run Demucs to isolate vocals"),
    min_speech_ms: int = typer.Option(1500, "--min-speech-ms"),
    max_clip_sec: int = typer.Option(12, "--max-clip-sec"),
    pad_ms: int = typer.Option(150, "--pad-ms"),
    merge_gap_ms: int = typer.Option(300, "--merge-gap-ms"),
    min_rms_db: float = typer.Option(None, "--min-rms-db"),
    ds_threads: int = typer.Option(4, "--ds-threads", help="FFmpeg threads for slicing"),
    keep_existing_clips: bool = typer.Option(False, "--keep-existing-clips", help="Skip existing clips"),
    no_clip_aac: bool = typer.Option(False, "--no-clip-aac", help="Skip AAC mirrors"),
    clip_aac_bitrate: int = typer.Option(320, "--clip-aac-bitrate"),
):
    """Run the full VOD → transcription → dataset pipeline."""
    configure_temp_dir(Path.cwd())

    streamer_slug, vod_dir, dataset_dir = resolve_output_dirs(vod, Path(outdir), Path(dataset_out))
    vod_dir.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    typer.echo(f"[i] Streamer bucket: {streamer_slug}")
    typer.echo(f"[i] VOD artifacts: {vod_dir}")
    typer.echo(f"[i] Dataset dir: {dataset_dir}")

    meta = run_transcription(
        vod=vod,
        out_dir=vod_dir,
        model=model,
        language=language,
        threads=threads,
        device="cuda",
        compute_type=compute_type,
        progress_interval=progress_interval,
        vod_quality=vod_quality,
        mux_subs=mux_subs,
        also_vtt=True,
        also_txt=True,
        force=force,
        max_duration=max_duration,
    )

    run_dataset(
        input_audio=Path(meta.get("audio_full") or meta["audio"]),
        srt_path=Path(meta["srt"]),
        out_dir=dataset_dir,
        use_demucs=use_demucs,
        min_speech_ms=min_speech_ms,
        max_clip_sec=max_clip_sec,
        pad_ms=pad_ms,
        merge_gap_ms=merge_gap_ms,
        min_rms_db=min_rms_db,
        threads=ds_threads,
        force=force or not keep_existing_clips,
        clip_aac=not no_clip_aac,
        clip_aac_bitrate=clip_aac_bitrate,
    )
    typer.echo("[OK] Pipeline complete!")


if __name__ == "__main__":
    app()
