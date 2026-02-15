"""API routes for the wizard."""

import datetime
import asyncio
import json
import os
import shutil
import subprocess
import sys
import threading
import queue
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from streamcraft.models.api import (
    VodMetaResponse,
    RunAudioRequest,
    RunAudioResponse,
    RunSanitizeRequest,
    RunSanitizeResponse,
    RunSrtRequest,
    RunSrtResponse,
    RunTtsRequest,
    RunTtsResponse,
    RunTrainRequest,
    RunTrainResponse,
    CreateJobRequest,
    SaveSegmentReviewRequest,
    SaveSegmentReviewResponse,
    GetSegmentReviewResponse,
    SegmentReviewVote,
    ExportClipsRequest,
    ExportClipsResponse,
    ExportClipItem,
    SegmentManifestResponse,
    SegmentManifestItem,
    JobResponse,
    UpdateJobRequest,
    TranscribeSegmentRequest,
    TranscribeSegmentWord,
    DatasetListResponse,
    DatasetRecordResponse,
    StreamerDatasetSummaryListResponse,
    StreamerDatasetSummaryResponse,
)
from streamcraft.settings import get_settings
from streamcraft.jobs.datasets_index import get_datasets_index, refresh_datasets_index, summarize_streamers

router = APIRouter()
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
_sanitize_cancel_lock = threading.Lock()
_sanitize_cancel_events: dict[str, threading.Event] = {}


def _get_sanitize_cancel_event(job_id: str) -> threading.Event:
    with _sanitize_cancel_lock:
        event = _sanitize_cancel_events.get(job_id)
        if not event:
            event = threading.Event()
            _sanitize_cancel_events[job_id] = event
        return event


def _clear_sanitize_cancel_event(job_id: str) -> None:
    with _sanitize_cancel_lock:
        _sanitize_cancel_events.pop(job_id, None)


def _timestamp_logs(lines: list[str]) -> list[str]:
    now = datetime.datetime.utcnow()
    stamped: list[str] = []
    for idx, line in enumerate(lines):
        stamp = (now + datetime.timedelta(seconds=idx)).strftime("%H:%M:%S")
        stamped.append(f"[{stamp}] {line}")
    if not lines:
        stamped.append(f"[{now.strftime('%H:%M:%S')}] sanitize completed (no log emitted)")
    return stamped


@router.post("/vod/check")
async def check_vod(vod_url: str = Query(...)) -> VodMetaResponse:
    """Check VOD and return metadata from Twitch or YouTube."""
    try:
        # Detect platform from URL
        platform = "youtube" if "youtube.com" in vod_url or "youtu.be" in vod_url else "twitch"
        
        if platform == "youtube":
            # YouTube support placeholder - extract video ID and return basic metadata
            # TODO: Implement YouTube metadata fetch using yt-dlp
            import re
            yt_pattern = r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)"
            match = re.search(yt_pattern, vod_url)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid YouTube URL")
            video_id = match.group(1)
            
            return VodMetaResponse(
                streamer="YouTube Channel",
                vodId=video_id,
                title="YouTube Video (metadata fetch not yet implemented)",
                duration="0:00",
                previewUrl=f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                platform="youtube"
            )
        
        # Twitch flow
        # Import inside try to catch missing twitchdl gracefully
        from twitchdl import twitch, utils  # type: ignore

        if not vod_url.startswith("http"):
            raise HTTPException(status_code=400, detail="Only Twitch/YouTube URLs supported for metadata fetch")

        vid = utils.parse_video_identifier(vod_url)
        if not vid:
            raise HTTPException(status_code=400, detail="Invalid Twitch VOD URL")

        video = twitch.get_video(vid)
        if not video:
            raise HTTPException(status_code=404, detail="VOD not found on Twitch")

        owner = video.get("owner") or {}
        streamer = owner.get("login") or owner.get("displayName") or "unknown"
        title = video.get("title") or "Untitled VOD"
        duration_raw = video.get("lengthSeconds") or video.get("durationSeconds") or video.get("duration") or 0
        try:
            duration_sec = int(duration_raw)
        except (TypeError, ValueError):
            duration_sec = 0
        hours = duration_sec // 3600
        minutes = (duration_sec % 3600) // 60
        seconds = duration_sec % 60
        duration = f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"

        # Get thumbnail - Twitch provides previewUrlTemplate with {width}x{height}
        thumb_list = video.get("thumbnailURLs") or []
        preview_template = video.get("previewThumbnailURL") or (thumb_list[0] if thumb_list else "")
        if preview_template and "{width}" in preview_template:
            preview_url = preview_template.replace("{width}", "640").replace("{height}", "360")
        else:
            preview_url = preview_template or f"https://static-cdn.jtvnw.net/cf_vods/d{vid[1:]}/thumb/thumb0-640x360.jpg"

        return VodMetaResponse(
            streamer=streamer,
            vodId=vid,
            title=title,
            duration=duration,
            previewUrl=preview_url,
            platform="twitch"
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="twitchdl not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch VOD metadata: {str(e)}")



@router.post("/audio/run")
async def run_audio(request: RunAudioRequest) -> RunAudioResponse:
    """Extract audio from VOD."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs, configure_temp_dir
        from streamcraft.core.transcribe import extract_audio

        configure_temp_dir(Path.cwd())

        vod_url = request.vodUrl
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        _, vod_dir, _ = resolve_output_dirs(vod_url, out_root, dataset_root)
        vod_dir.mkdir(parents=True, exist_ok=True)

        log_buffer = []

        def log(msg: str):
            timestamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
            entry = f"[{timestamp}] {msg}"
            log_buffer.append(entry)

        def download_with_fallback(url: str, out_dir: Path, quality: str, auth_token: str | None) -> Path:
            out_dir.mkdir(parents=True, exist_ok=True)
            # derive basename
            import re

            m = re.search(r"(\d{6,})", url)
            base = m.group(1) if m else "vod"
            target = out_dir / f"{base}.mp4"

            # If already exists and not forcing re-download
            if target.exists() and not request.force:
                return target

            qualities = []
            seen = set()
            for q in [quality, "audio_only", "source", "720p", "1080p"]:
                if q and q not in seen:
                    qualities.append(q)
                    seen.add(q)

            last_err = None
            for q in qualities:
                if target.exists():
                    try:
                        target.unlink()
                    except Exception:
                        pass
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
                    q,
                ]
                if auth_token:
                    cmd.extend(["--auth-token", auth_token])

                log(f"twitchdl try quality={q}: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode == 0 and target.exists():
                    return target

                err_text = (result.stderr or result.stdout or "").strip()
                last_err = f"quality={q} code={result.returncode} {err_text}"
                log(f"twitchdl failed: {last_err}")

            raise RuntimeError(f"twitchdl failed for all qualities. Last error: {last_err or 'unknown'}")

        log("Ensuring VOD media is ready...")
        settings = get_settings()
        auth_token = request.authToken or os.environ.get("TWITCHDL_AUTH_TOKEN")
        quality = request.vodQuality or settings.vod_quality
        download_target = download_with_fallback(vod_url, vod_dir, quality=quality, auth_token=auth_token)
        log(f"VOD ready at {download_target}")

        log("Extracting PCM audio via ffmpeg...")
        audio_full, _ = extract_audio(download_target, vod_dir)
        log(f"Audio ready {audio_full}")

        return RunAudioResponse(
            path=to_workspace_relative(audio_full),
            exitCode=0,
            log=log_buffer,
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {exc}")


@router.post("/sanitize/run")
async def run_sanitize(request: RunSanitizeRequest) -> RunSanitizeResponse:
    """Sanitize audio by trimming silence and normalizing speech segments."""

    try:
        from streamcraft.core.pipeline import configure_temp_dir, resolve_output_dirs
        from streamcraft.core.sanitize_v2 import SanitiseConfig, SanitiseMode, SanitisePreset, run_sanitise_v2

        configure_temp_dir(Path.cwd())

        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, _, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root)

        mode = SanitiseMode(request.mode) if request.mode in {"auto", "voice"} else (SanitiseMode.VOICE if request.voiceSample else SanitiseMode.AUTO)
        preset = SanitisePreset(request.preset) if request.preset in {"strict", "balanced", "lenient"} else SanitisePreset.BALANCED

        cfg = SanitiseConfig(
            mode=mode,
            preset=preset,
            strictness=float(request.strictness),
            extract_vocals=request.extractVocals,
            preview=request.preview,
            preview_start=request.previewStart,
            preview_duration=request.previewDuration,
            voice_sample_count=request.voiceSampleCount,
            voice_sample_min_duration=request.voiceSampleMinDuration,
            voice_sample_max_duration=request.voiceSampleMaxDuration,
            voice_sample_min_rms_db=request.voiceSampleMinRmsDb,
            manual_samples=request.manualSamples,
            preserve_pauses=request.preservePauses,
            reduce_sfx=request.reduceSfx,
            target_lufs=request.targetLufs,
            true_peak_limit_db=request.truePeakLimitDb,
            fade_ms=request.fadeMs,
        )

        def serialize_result(result):
            segments = result.segments
            total_duration = sum(seg.duration for seg in segments if seg.kept)
            timestamped_log = _timestamp_logs(result.log)

            return RunSanitizeResponse(
                cleanPath=to_workspace_relative(result.clean_path),
                segmentsPath=to_workspace_relative(result.manifest_path),
                segments=len(segments),
                cleanDuration=total_duration,
                previewSegments=[
                    {
                        "start": seg.start,
                        "end": seg.end,
                        "duration": seg.duration,
                        "rmsDb": None,
                        "quality": seg.quality,
                        "speechRatio": seg.speech_ratio,
                        "snrDb": seg.snr_db,
                        "clipRatio": seg.clip_ratio,
                        "sfxScore": seg.sfx_score,
                        "speakerSim": seg.speaker_sim,
                        "kept": seg.kept,
                        "labels": seg.labels,
                        "rejectReason": seg.reject_reason,
                    }
                    for seg in segments[:500]
                ],
                previewPath=to_workspace_relative(result.preview_path),
                previewSampleRate=result.preview_sr,
                appliedSettings={
                    "mode": cfg.mode.value,
                    "preset": cfg.preset.value,
                    "strictness": cfg.strictness,
                    "params": result.params,
                },
                voiceSamples=[
                    {
                        "start": vs.get("start"),
                        "end": vs.get("end"),
                        "duration": vs.get("duration"),
                        "rmsDb": vs.get("rmsDb"),
                        "path": to_workspace_relative(dataset_dir / Path(vs.get("path", ""))),
                    }
                    for vs in result.voice_samples
                ],
                exitCode=0,
                log=timestamped_log,
            )

        cancel_event = None
        if request.jobId:
            cancel_event = _get_sanitize_cancel_event(request.jobId)
            cancel_event.clear()

        if request.stream:
            q: queue.Queue[dict] = queue.Queue()

            def event_cb(evt: dict) -> None:
                try:
                    q.put(evt, block=False)
                except Exception:
                    pass

            def worker() -> None:
                try:
                    result = run_sanitise_v2(
                        request.vodUrl,
                        out_root,
                        dataset_root,
                        cfg,
                        event_cb=event_cb,
                        should_cancel=cancel_event.is_set if cancel_event else None,
                        run_id=request.runId,
                    )
                    try:
                        payload = serialize_result(result)
                        result_dict = payload.dict()
                        q.put({"type": "done", "result": result_dict})
                    except Exception as ser_exc:
                        import traceback
                        error_msg = f"Failed to serialize result: {ser_exc}"
                        q.put({"type": "error", "error": error_msg, "status": 500})
                        q.put({"type": "log", "line": f"[SERIALIZATION ERROR] {traceback.format_exc()}"})
                except FileNotFoundError as exc:
                    import traceback
                    q.put({"type": "error", "error": str(exc), "status": 404})
                    q.put({"type": "log", "line": f"[ERROR] {traceback.format_exc()}"})
                except Exception as exc:
                    import traceback
                    exc_text = str(exc)
                    if "canceled by user" in exc_text.lower():
                        error_msg = "Sanitize canceled by user"
                    else:
                        error_msg = f"Sanitize failed: {exc}"
                    try:
                        q.put({"type": "error", "error": error_msg, "status": 500})
                        q.put({"type": "log", "line": f"[ERROR] {error_msg}"})
                        q.put({"type": "log", "line": f"[TRACEBACK] {traceback.format_exc()}"})
                    except:
                        # Last resort - at least try to put the error
                        try:
                            q.put({"type": "error", "error": "Sanitize failed with unrecoverable error", "status": 500})
                        except:
                            pass  # Nothing more we can do

                finally:
                    if request.jobId:
                        _clear_sanitize_cancel_event(request.jobId)

            threading.Thread(target=worker, daemon=True).start()

            def iterator():
                while True:
                    evt = q.get()
                    yield json.dumps(evt) + "\n"
                    if evt.get("type") in {"done", "error"}:
                        break

            return StreamingResponse(iterator(), media_type="application/x-ndjson")

        result = run_sanitise_v2(
            request.vodUrl,
            out_root,
            dataset_root,
            cfg,
            should_cancel=cancel_event.is_set if cancel_event else None,
            run_id=request.runId,
        )

        payload = serialize_result(result)
        if request.jobId:
            _clear_sanitize_cancel_event(request.jobId)
        return payload
    except FileNotFoundError as exc:
        if request.jobId:
            _clear_sanitize_cancel_event(request.jobId)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        if request.jobId:
            _clear_sanitize_cancel_event(request.jobId)
        raise HTTPException(status_code=500, detail=f"Sanitize failed: {exc}")


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
    event = _get_sanitize_cancel_event(job_id)
    event.set()
    return {"status": "cancel-requested"}


def _segment_review_path(vod_url: str, out_root: Path, dataset_root: Path) -> Path:
    from streamcraft.core.pipeline import resolve_output_dirs

    _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
    vod_slug = vod_dir.name
    
    # Try flat structure first (legacy)
    review_path = dataset_dir / f"{vod_slug}_segment_review.json"
    if not review_path.exists():
        # Fall back to latest run in versioned structure
        runs_dir = dataset_dir / "runs"
        if runs_dir.exists():
            run_dirs = sorted([d for d in runs_dir.iterdir() if d.is_dir()], reverse=True)
            for run_dir in run_dirs:
                candidate = run_dir / f"{vod_slug}_segment_review.json"
                if candidate.exists():
                    return candidate
    
    return review_path


def _load_review_payload(review_path: Path) -> dict:
    if not review_path.exists():
        raise FileNotFoundError("Segment review not found; run swipe review first")
    try:
        return json.loads(review_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted review file: {exc}")


def _find_latest_run_manifest(dataset_dir: Path, vod_slug: str) -> Path | None:
    """Find the most recent manifest in runs/ directory structure."""
    runs_dir = dataset_dir / "runs"
    if not runs_dir.exists():
        return None
    
    # Find all run directories
    run_dirs = [d for d in runs_dir.iterdir() if d.is_dir()]
    if not run_dirs:
        return None
    
    # Sort by name (which are timestamps like 20260213_011641)
    run_dirs.sort(reverse=True)
    
    # Look for manifest in each run, newest first
    manifest_name = f"{vod_slug}_segments.json"
    for run_dir in run_dirs:
        manifest_path = run_dir / manifest_name
        if manifest_path.exists():
            return manifest_path
    
    return None


def _load_manifest(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        raise FileNotFoundError("Sanitize manifest missing; run sanitize first")
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted manifest: {exc}")


@router.get("/sanitize/segments")
async def get_sanitize_segments(
    vodUrl: str = Query(..., description="VOD URL the segments belong to"),
    outdir: str = Query("out"),
    datasetOut: str = Query("dataset"),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
) -> SegmentManifestResponse:
    from streamcraft.core.pipeline import resolve_output_dirs
    from streamcraft.core.dataset import parse_srt

    out_root = Path(outdir or "out")
    dataset_root = Path(datasetOut or "dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(vodUrl, out_root, dataset_root)
    
    # Try flat structure first (legacy)
    manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
    if not manifest_path.exists():
        # Fall back to latest run in versioned structure
        latest_manifest = _find_latest_run_manifest(dataset_dir, vod_dir.name)
        if latest_manifest:
            manifest_path = latest_manifest
    
    payload = _load_manifest(manifest_path)
    
    # Load SRT for transcription text
    srt_path = vod_dir / f"{vod_dir.name}.srt"
    srt_cues = []
    if srt_path.exists():
        try:
            srt_cues = parse_srt(srt_path)
        except Exception:
            pass  # SRT not available, segments will have no text

    clean_path = vod_dir / f"{vod_dir.name}_clean.wav"
    clean_path_rel = to_workspace_relative(clean_path) if clean_path.exists() else None
    original_path = vod_dir / f"{vod_dir.name}_full.wav"
    original_path_rel = to_workspace_relative(original_path) if original_path.exists() else None

    segments = payload.get("segments") or []
    sample_rate = int(payload.get("source", {}).get("sample_rate") or 0)

    total = len(segments)
    slice_start = min(max(0, offset), total)
    slice_end = min(total, slice_start + limit)

    clean_offsets: dict[int, tuple[float, float]] = {}
    cursor = 0.0
    for idx, seg in enumerate(segments):
        if not seg.get("kept"):
            continue
        duration = float(seg.get("dur", 0.0))
        clean_offsets[idx] = (cursor, cursor + duration)
        cursor += duration

    items: list[SegmentManifestItem] = []
    for idx in range(slice_start, slice_end):
        seg = segments[idx]
        clean_start, clean_end = clean_offsets.get(idx, (None, None))
        
        # Match segment with SRT cues by time overlap
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", 0.0))
        text = None
        if srt_cues:
            # Find all cues that overlap with this segment
            overlapping = [
                cue for cue in srt_cues
                if not (cue.end <= seg_start or cue.start >= seg_end)
            ]
            if overlapping:
                text = " ".join(cue.text for cue in overlapping).strip()
        
        items.append(
            SegmentManifestItem(
                index=idx,
                start=seg_start,
                end=seg_end,
                duration=float(seg.get("dur", 0.0)),
                cleanStart=clean_start,
                cleanEnd=clean_end,
                kept=seg.get("kept"),
                text=text,
                quality=seg.get("quality"),
                speechRatio=seg.get("speech_ratio"),
                snrDb=seg.get("snr_db"),
                clipRatio=seg.get("clip_ratio"),
                sfxScore=seg.get("sfx_score"),
                speakerSim=seg.get("speaker_sim"),
                labels=seg.get("labels") or [],
                rejectReason=seg.get("reject_reason") or [],
            )
        )

    return SegmentManifestResponse(
        sampleRate=sample_rate,
        cleanPath=clean_path_rel,
        originalPath=original_path_rel,
        segments=items,
        total=total,
        offset=slice_start,
        limit=limit,
        hasMore=slice_end < total,
    )


@router.post("/train/run")
async def run_train(request: RunTrainRequest) -> RunTrainResponse:
    """Slice sanitized audio + SRT into a voice dataset."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs, configure_temp_dir
        from streamcraft.core.dataset import run_dataset
        import streamcraft.core.dataset as dataset_module
        import shutil
        import subprocess

        configure_temp_dir(Path.cwd())

        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        streamer_slug, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root)
        vod_slug = vod_dir.name

        clean_audio = vod_dir / f"{vod_slug}_clean.wav"
        srt_path = vod_dir / f"{vod_slug}.srt"
        clips_dir = dataset_dir / "clips"
        manifest_csv = dataset_dir / "manifest.csv"
        segments_json = dataset_dir / "segments.json"

        if not clean_audio.exists():
            raise HTTPException(status_code=400, detail="Clean audio missing; run Sanitize first")
        if not srt_path.exists():
            raise HTTPException(status_code=400, detail="SRT missing; run SRT first")

        log_buffer: list[str] = []

        def add_log(msg: str):
            stamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
            log_buffer.append(f"[{stamp}] {msg}")

        def execute_train(log_writer) -> dict:
            log_writer(f"Streamer bucket: {streamer_slug}")
            log_writer(f"Dataset dir: {dataset_dir}")
            log_writer(f"Input audio: {clean_audio}")
            log_writer(f"SRT: {srt_path}")
            log_writer("[progress] 10% Preparing dataset slicing")

            original_log = dataset_module.log
            original_log_ok = dataset_module.log_ok
            original_log_warn = dataset_module.log_warn
            dataset_module.log = log_writer
            dataset_module.log_ok = log_writer
            dataset_module.log_warn = log_writer

            try:
                run_dataset(
                    input_audio=clean_audio,
                    srt_path=srt_path,
                    out_dir=dataset_dir,
                    use_demucs=False,
                    min_speech_ms=request.minSpeechMs,
                    max_clip_sec=request.maxClipSec,
                    pad_ms=request.padMs,
                    merge_gap_ms=request.mergeGapMs,
                    min_rms_db=None,
                    threads=request.threads,
                    force=request.force,
                    clip_aac=request.clipAac,
                    clip_aac_bitrate=request.clipAacBitrate,
                )
            finally:
                dataset_module.log = original_log
                dataset_module.log_ok = original_log_ok
                dataset_module.log_warn = original_log_warn

            log_writer("[progress] 70% Slicing complete, copying artifacts")

            copied_clean = dataset_dir / f"{vod_slug}_clean.wav"
            try:
                shutil.copyfile(clean_audio, copied_clean)
                log_writer(f"Copied clean WAV -> {copied_clean}")
            except Exception as exc:
                log_writer(f"WARN: could not copy clean WAV: {exc}")

            if request.clipAac:
                aac_path = dataset_dir / f"{vod_slug}_clean.m4a"
                try:
                    cmd = [
                        "ffmpeg",
                        "-y",
                        "-i",
                        str(clean_audio),
                        "-vn",
                        "-c:a",
                        "aac",
                        "-b:a",
                        f"{request.clipAacBitrate}k",
                        str(aac_path),
                    ]
                    subprocess.run(cmd, check=True, capture_output=True)
                    log_writer(f"Exported AAC reference -> {aac_path}")
                except Exception as exc:
                    log_writer(f"WARN: AAC export failed: {exc}")

            clip_count = len(list(clips_dir.glob("*.wav"))) + len(list(clips_dir.glob("*.m4a")))
            log_writer(f"Clip count: {clip_count}")
            log_writer("[progress] 90% Refreshing datasets index")

            refresh_datasets_index(dataset_root, out_root, WORKSPACE_ROOT)
            log_writer("[progress] 100% Training complete")

            return {
                "datasetPath": to_workspace_relative(dataset_dir),
                "clipsDir": to_workspace_relative(clips_dir),
                "manifestPath": to_workspace_relative(manifest_csv),
                "segmentsPath": to_workspace_relative(segments_json),
                "exitCode": 0,
                "log": log_buffer,
            }

        if not request.stream:
            payload = execute_train(add_log)
            return RunTrainResponse(**payload)

        events: queue.Queue[object] = queue.Queue()
        sentinel = object()

        def stream_log(msg: str) -> None:
            add_log(msg)
            events.put(json.dumps({"type": "log", "line": log_buffer[-1]}))

        def worker() -> None:
            try:
                payload = execute_train(stream_log)
                events.put(json.dumps({"type": "done", "result": payload}))
            except Exception as exc:
                events.put(json.dumps({"type": "error", "error": f"Training failed: {exc}"}))
            finally:
                events.put(sentinel)

        async def iterator():
            thread = threading.Thread(target=worker, daemon=True)
            thread.start()

            while True:
                item = await asyncio.to_thread(events.get)
                if item is sentinel:
                    break
                yield f"{item}\n"

        return StreamingResponse(iterator(), media_type="application/x-ndjson")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Training failed: {exc}")


@router.get("/sanitize/review")
async def get_segment_review(
    vodUrl: str = Query(..., description="VOD URL the review belongs to"),
    outdir: str = Query("out"),
    datasetOut: str = Query("dataset"),
) -> GetSegmentReviewResponse:
    out_root = Path(outdir or "out")
    dataset_root = Path(datasetOut or "dataset")
    review_path = _segment_review_path(vodUrl, out_root, dataset_root)
    workspace_path = to_workspace_relative(review_path)

    if not review_path.exists():
        return GetSegmentReviewResponse(
            reviewPath=workspace_path,
            totalSegments=0,
            reviewIndex=0,
            accepted=0,
            rejected=0,
            updatedAt=None,
            votes=[],
        )

    try:
        payload = json.loads(review_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted review file: {exc}")

    votes_payload = [SegmentReviewVote(**entry) for entry in payload.get("votes", [])]

    return GetSegmentReviewResponse(
        reviewPath=workspace_path,
        totalSegments=int(payload.get("totalSegments", 0)),
        reviewIndex=int(payload.get("reviewIndex", 0)),
        accepted=int(payload.get("accepted", 0)),
        rejected=int(payload.get("rejected", 0)),
        updatedAt=payload.get("updatedAt"),
        votes=votes_payload,
    )


@router.post("/sanitize/review")
async def save_segment_review(request: SaveSegmentReviewRequest) -> SaveSegmentReviewResponse:
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    review_path = _segment_review_path(request.vodUrl, out_root, dataset_root)
    review_path.parent.mkdir(parents=True, exist_ok=True)

    accepted = sum(1 for vote in request.votes if vote.decision == "accept")
    rejected = sum(1 for vote in request.votes if vote.decision == "reject")
    updated_at = datetime.datetime.utcnow().isoformat() + "Z"

    payload = {
        "vodUrl": request.vodUrl,
        "totalSegments": request.totalSegments,
        "reviewIndex": request.reviewIndex,
        "accepted": accepted,
        "rejected": rejected,
        "updatedAt": updated_at,
        "votes": [vote.dict() for vote in request.votes],
    }

    review_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return SaveSegmentReviewResponse(
        reviewPath=to_workspace_relative(review_path),
        totalSegments=request.totalSegments,
        reviewIndex=request.reviewIndex,
        accepted=accepted,
        rejected=rejected,
        updatedAt=updated_at,
        votes=request.votes,
    )


@router.post("/sanitize/export-clips")
async def export_sanitize_clips(request: ExportClipsRequest) -> ExportClipsResponse:
    """Export accepted review segments as individual WAV clips per streamer/VOD."""

    from streamcraft.core.pipeline import resolve_output_dirs

    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root)

    review_path = _segment_review_path(request.vodUrl, out_root, dataset_root)
    review_payload = _load_review_payload(review_path)
    votes = review_payload.get("votes", [])
    accepted_indices = [entry.get("index") for entry in votes if entry.get("decision") == "accept"]

    if not accepted_indices:
        return ExportClipsResponse(clipsDir="", sampleRate=0, count=0, items=[])

    manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
    manifest_payload = _load_manifest(manifest_path)
    segments = manifest_payload.get("segments") or []
    sr = int(manifest_payload.get("sampleRate") or 0)
    if sr <= 0:
        raise HTTPException(status_code=500, detail="Manifest missing sampleRate")

    clean_path = vod_dir / f"{vod_dir.name}_clean.wav"
    if not clean_path.exists():
        raise HTTPException(status_code=404, detail="Clean audio missing; run sanitize first")

    audio, audio_sr = sf.read(str(clean_path), always_2d=False)
    if audio_sr != sr:
        # tolerate mismatch but log via detail
        sr = audio_sr

    clip_dir = dataset_dir / vod_dir.name / "clips_review"
    clip_dir.mkdir(parents=True, exist_ok=True)

    items: list[ExportClipItem] = []
    for idx in accepted_indices:
        if idx is None:
            continue
        if idx < 0 or idx >= len(segments):
            continue
        seg = segments[idx]
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start))
        if end <= start:
            continue
        start_idx = max(0, int(start * sr))
        end_idx = min(len(audio), int(end * sr))
        if end_idx <= start_idx:
            continue
        clip_audio = audio[start_idx:end_idx]
        clip_path = clip_dir / f"{vod_dir.name}_keep_{idx:04d}.wav"
        sf.write(str(clip_path), clip_audio, sr)
        items.append(
            ExportClipItem(
                index=idx,
                start=start,
                end=end,
                duration=end - start,
                path=to_workspace_relative(clip_path),
            )
        )

    return ExportClipsResponse(
        clipsDir=to_workspace_relative(clip_dir),
        sampleRate=sr,
        count=len(items),
        items=items,
    )


@router.post("/srt/run")
async def run_srt(request: RunSrtRequest) -> RunSrtResponse:
    """Transcribe audio to SRT using faster-whisper."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs, configure_temp_dir
        from streamcraft.core.transcribe import run_transcription

        configure_temp_dir(Path.cwd())

        vod_url = request.vodUrl
        out_root = Path("out")
        dataset_root = Path("dataset")

        _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
        vod_dir.mkdir(parents=True, exist_ok=True)

        log_buffer: list[str] = []

        def capture_log(msg: str):
            timestamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
            entry = f"[{timestamp}] {msg}"
            log_buffer.append(entry)
            try:
                print(entry)
            except UnicodeEncodeError:
                stdout = getattr(sys, "stdout", None)
                if stdout is not None:
                    safe = entry.encode("utf-8", errors="replace").decode("utf-8", errors="replace")
                    stdout.buffer.write((safe + "\n").encode("utf-8", errors="replace"))
                    stdout.flush()

        def _prepare_accepted_only_audio(log_writer) -> Path:
            vod_slug = vod_dir.name
            clean_path = vod_dir / f"{vod_slug}_clean.wav"
            if not clean_path.exists() or clean_path.stat().st_size == 0:
                raise RuntimeError("Accepted-only SRT requires clean audio; run sanitize first")

            manifest_path = dataset_dir / f"{vod_slug}_segments.json"
            if not manifest_path.exists():
                latest_manifest = _find_latest_run_manifest(dataset_dir, vod_slug)
                if latest_manifest:
                    manifest_path = latest_manifest

            payload = _load_manifest(manifest_path)
            segments = payload.get("segments") or []
            if not segments:
                raise RuntimeError("Accepted-only SRT requires sanitize segments manifest")

            kept_indices = {idx for idx, seg in enumerate(segments) if bool(seg.get("kept"))}
            if not kept_indices:
                raise RuntimeError("No kept segments available for accepted-only SRT")

            accepted_indices = set(kept_indices)
            review_path = _segment_review_path(vod_url, out_root, dataset_root)
            if review_path.exists():
                review_payload = _load_review_payload(review_path)
                votes = review_payload.get("votes") or []
                for vote in votes:
                    idx = vote.get("index")
                    decision = vote.get("decision")
                    if not isinstance(idx, int) or idx not in kept_indices:
                        continue
                    if decision == "reject":
                        accepted_indices.discard(idx)
                    elif decision == "accept":
                        accepted_indices.add(idx)
                log_writer(
                    f"[i] Review filters applied for SRT: accepted={len(accepted_indices)} kept={len(kept_indices)}"
                )

            if not accepted_indices:
                raise RuntimeError("All kept segments were rejected; cannot run accepted-only SRT")

            if len(accepted_indices) == len(kept_indices):
                log_writer(f"[i] Accepted-only SRT uses clean audio: {clean_path}")
                return clean_path

            clean_offsets: dict[int, tuple[float, float]] = {}
            cursor = 0.0
            for idx, seg in enumerate(segments):
                if idx not in kept_indices:
                    continue
                start = float(seg.get("start", 0.0))
                end = float(seg.get("end", start))
                duration = float(seg.get("dur", max(0.0, end - start)))
                if duration <= 0:
                    continue
                clean_offsets[idx] = (cursor, cursor + duration)
                cursor += duration

            audio, sr = sf.read(str(clean_path), always_2d=False)
            chunks = []
            sorted_indices = sorted(accepted_indices)
            for idx in sorted_indices:
                bounds = clean_offsets.get(idx)
                if not bounds:
                    continue
                start_sec, end_sec = bounds
                start_idx = max(0, int(start_sec * sr))
                end_idx = min(len(audio), int(end_sec * sr))
                if end_idx <= start_idx:
                    continue
                chunks.append(audio[start_idx:end_idx])

            if not chunks:
                raise RuntimeError("Accepted-only SRT found no valid audio chunks")

            import numpy as np

            accepted_audio = np.concatenate(chunks)
            accepted_path = vod_dir / f"{vod_slug}_srt_accepted.wav"
            sf.write(str(accepted_path), accepted_audio, sr)
            log_writer(
                f"[i] Accepted-only SRT audio prepared: {accepted_path} "
                f"(segments={len(sorted_indices)}/{len(kept_indices)})"
            )
            return accepted_path

        def execute_transcription(log_writer) -> dict:
            log_writer(f"SRT start vod={vod_url} out_dir={vod_dir}")

            speed_profiles = {
                "fast": {"model": "small", "threads": 4, "compute_type": "float16", "progress_interval": 6.0},
                "balanced": {"model": "medium", "threads": 6, "compute_type": "float16", "progress_interval": 8.0},
                "accurate": {"model": "large-v3", "threads": 8, "compute_type": "float16", "progress_interval": 10.0},
            }
            selected_speed = request.speed if request.speed in speed_profiles else "balanced"
            profile = speed_profiles[selected_speed]
            transcription_override: Path | None = None
            if request.acceptedOnly:
                transcription_override = _prepare_accepted_only_audio(log_writer)

            log_writer(
                f"SRT options: speed={selected_speed} model={profile['model']} "
                f"threads={profile['threads']} acceptedOnly={request.acceptedOnly}"
            )

            import streamcraft.core.transcribe as transcribe_module
            original_log = transcribe_module.log
            original_log_ok = transcribe_module.log_ok
            transcribe_module.log = log_writer
            transcribe_module.log_ok = log_writer

            try:
                result = run_transcription(
                    vod=vod_url,
                    out_dir=vod_dir,
                    model=profile["model"],
                    language="auto",
                    threads=profile["threads"],
                    device="cuda",
                    compute_type=profile["compute_type"],
                    progress_interval=profile["progress_interval"],
                    vod_quality="audio_only",
                    mux_subs=False,
                    also_vtt=False,
                    also_txt=True,
                    force=False,
                    max_duration=None,
                    transcription_audio_override=transcription_override,
                )
            finally:
                transcribe_module.log = original_log
                transcribe_module.log_ok = original_log_ok

            log_writer(
                f"Transcription result: media={result.get('media')} "
                f"audio={result.get('audio')} audio_full={result.get('audio_full')}"
            )
            srt_path = Path(result["srt"])
            log_writer(f"SRT path: {srt_path}")
            if not srt_path.exists():
                raise RuntimeError("SRT file not created")

            srt_content = srt_path.read_text(encoding="utf-8")
            lines = len([line for line in srt_content.split("\n") if "-->" in line])
            if srt_path.stat().st_size == 0 or lines == 0:
                raise RuntimeError(
                    "SRT output is empty or invalid (0 subtitle lines). "
                    "Transcription did not produce timed segments."
                )

            excerpt = "\n".join(srt_content.split("\n")[:20])
            return {
                "path": to_workspace_relative(srt_path),
                "lines": lines,
                "excerpt": excerpt,
                "exitCode": 0,
            }

        if not request.stream:
            result_payload = execute_transcription(capture_log)
            return RunSrtResponse(
                path=result_payload["path"],
                lines=result_payload["lines"],
                excerpt=result_payload["excerpt"],
                exitCode=result_payload["exitCode"],
                log=log_buffer,
            )

        events: queue.Queue[object] = queue.Queue()
        sentinel = object()

        def stream_log(msg: str) -> None:
            capture_log(msg)
            events.put(json.dumps({"type": "log", "line": log_buffer[-1]}))

        def worker() -> None:
            try:
                result_payload = execute_transcription(stream_log)
                events.put(json.dumps({"type": "done", "result": result_payload}))
            except Exception as exc:
                events.put(json.dumps({"type": "error", "error": f"Transcription failed: {exc}"}))
            finally:
                events.put(sentinel)

        async def iterator():
            thread = threading.Thread(target=worker, daemon=True)
            thread.start()

            while True:
                item = await asyncio.to_thread(events.get)
                if item is sentinel:
                    break
                yield f"{item}\n"

        return StreamingResponse(iterator(), media_type="application/x-ndjson")

    except Exception as exc:
        import traceback

        tb = traceback.format_exc()
        print(f"[srt] exception: {exc}\n{tb}")
        # Return last traceback line to help identify Errno/filename/device issues in UI
        last = tb.strip().splitlines()[-1] if tb else str(exc)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc} | {last}")


@router.post("/srt/transcribe-segment")
async def transcribe_segment(request: TranscribeSegmentRequest):
    """Transcribe a single segment with word-level timestamps, streaming results as NDJSON."""
    import tempfile
    import numpy as np
    from faster_whisper import WhisperModel
    
    try:
        from streamcraft.core.pipeline import resolve_output_dirs
        from streamcraft.core.transcribe import detect_device, ensure_cuda_dlls_available
        
        # Resolve paths
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root)
        
        # Load segment manifest
        manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
        if not manifest_path.exists():
            raise HTTPException(status_code=404, detail="Segment manifest not found")
        
        with open(manifest_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        
        segments = payload.get("segments", [])
        if request.segmentIndex < 0 or request.segmentIndex >= len(segments):
            raise HTTPException(status_code=400, detail="Invalid segment index")
        
        segment = segments[request.segmentIndex]
        start_time = float(segment.get("start", 0.0))
        end_time = float(segment.get("end", 0.0))
        duration = end_time - start_time
        
        if duration <= 0:
            raise HTTPException(status_code=400, detail="Invalid segment duration")
        
        # Determine audio source - prefer clean, fallback to original
        clean_path = vod_dir / f"{vod_dir.name}_clean.wav"
        original_path = vod_dir / f"{vod_dir.name}_full.wav"
        
        # Check if segment has clean audio (was kept during sanitization)
        kept = segment.get("kept", False)
        
        if kept and clean_path.exists():
            # Use clean audio with cleanStart/cleanEnd if available
            audio_path = clean_path
            # Need to calculate clean offsets like in get_sanitize_segments
            clean_offsets = {}
            cursor = 0.0
            for idx, seg in enumerate(segments):
                if not seg.get("kept"):
                    continue
                dur = float(seg.get("dur", 0.0))
                clean_offsets[idx] = (cursor, cursor + dur)
                cursor += dur
            
            if request.segmentIndex in clean_offsets:
                start_time, end_time = clean_offsets[request.segmentIndex]
            else:
                # Fallback to original if clean offsets not found
                audio_path = original_path
                start_time = float(segment.get("start", 0.0))
                end_time = float(segment.get("end", 0.0))
        else:
            # Use original audio
            if not original_path.exists():
                raise HTTPException(status_code=404, detail="Audio file not found")
            audio_path = original_path
            start_time = float(segment.get("start", 0.0))
            end_time = float(segment.get("end", 0.0))
        
        # Load audio and extract segment
        audio_data, sample_rate = sf.read(audio_path)
        start_sample = int(start_time * sample_rate)
        end_sample = int(end_time * sample_rate)
        segment_audio = audio_data[start_sample:end_sample]
        
        # Save temporary segment audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            sf.write(tmp_path, segment_audio, sample_rate)

        # Initialize Whisper model
        device, compute_type = detect_device("cuda", "float16")
        if device == "cuda":
            ensure_cuda_dlls_available()
        
        model = WhisperModel("base", device=device, compute_type=compute_type, cpu_threads=4)
        
        # Stream transcription results as NDJSON
        async def generate():
            try:
                segments_iter, info = model.transcribe(
                    str(tmp_path),
                    language=None,
                    vad_filter=True,
                    beam_size=5,
                    word_timestamps=True,
                )
                
                # Send metadata
                yield json.dumps({
                    "type": "metadata",
                    "language": info.language,
                    "duration": duration,
                }) + "\n"
                
                # Stream words
                for seg in segments_iter:
                    if hasattr(seg, 'words') and seg.words:
                        for word_info in seg.words:
                            word_data = {
                                "type": "word",
                                "word": word_info.word.strip(),
                                "start": word_info.start,
                                "end": word_info.end,
                                "probability": word_info.probability,
                            }
                            yield json.dumps(word_data) + "\n"
                    else:
                        # Fallback if no word timestamps
                        yield json.dumps({
                            "type": "segment",
                            "text": seg.text.strip(),
                            "start": seg.start,
                            "end": seg.end,
                        }) + "\n"
                
                # Send completion
                yield json.dumps({"type": "done"}) + "\n"
                
            except Exception as exc:
                yield json.dumps({
                    "type": "error",
                    "message": str(exc),
                }) + "\n"
            finally:
                # Cleanup temporary file after streaming finishes
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
        
        return StreamingResponse(generate(), media_type="application/x-ndjson")
    
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        print(f"[transcribe-segment] exception: {exc}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Segment transcription failed: {exc}")


@router.post("/tts/run")
async def run_tts(request: RunTtsRequest):
    """Generate TTS output using XTTS v2. Supports streaming logs when stream=True."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs
        import subprocess
        import shutil
        from collections import defaultdict

        settings = get_settings()
        provider = (settings.tts_provider or "script").strip().lower()
        if provider != "script":
            raise HTTPException(
                status_code=501,
                detail=f"TTS provider '{provider}' is not implemented yet. Supported: script.",
            )

        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root)

        streamer_slug = (request.streamer or "").strip().lower()
        if not streamer_slug:
            raise HTTPException(status_code=400, detail="Missing streamer value for TTS")

        streamer_root = (dataset_root / streamer_slug).resolve()
        if not streamer_root.exists():
            raise HTTPException(status_code=404, detail=f"Streamer dataset root not found: {streamer_root}")

        def resolve_target_dataset_path(path_value: str | None) -> Path | None:
            if not path_value:
                return None
            candidate = Path(path_value)
            if not candidate.is_absolute():
                candidate = (WORKSPACE_ROOT / candidate).resolve()
            else:
                candidate = candidate.resolve()
            return candidate if candidate.exists() else None

        def collect_source_clip_dirs() -> list[Path]:
            dirs: list[Path] = []

            if request.sourceMode == "target_dataset":
                target_dataset = resolve_target_dataset_path(request.targetDatasetPath)
                if target_dataset is None:
                    raise HTTPException(status_code=400, detail="Target dataset not found for selected mode")
                target_clips = target_dataset / "clips"
                if target_clips.exists() and target_clips.is_dir():
                    dirs.append(target_clips)
                elif target_dataset.name == "clips" and target_dataset.is_dir():
                    dirs.append(target_dataset)
                else:
                    raise HTTPException(status_code=400, detail=f"Target dataset has no clips directory: {target_dataset}")
                return dirs

            base_clips = streamer_root / "clips"
            if base_clips.exists() and base_clips.is_dir():
                dirs.append(base_clips)

            runs_root = streamer_root / "runs"
            if runs_root.exists() and runs_root.is_dir():
                run_clip_dirs = sorted([p / "clips" for p in runs_root.iterdir() if p.is_dir()], reverse=True)
                dirs.extend([clip_dir for clip_dir in run_clip_dirs if clip_dir.exists() and clip_dir.is_dir()])

            if not dirs:
                raise HTTPException(status_code=404, detail=f"No clips directories found for streamer: {request.streamer}")
            return dirs

        quality_profiles = {
            "fast": {"clip_count": 8, "min_sec": 1.2, "max_sec": 8.0},
            "balanced": {"clip_count": 16, "min_sec": 1.5, "max_sec": 10.0},
            "best": {"clip_count": 32, "min_sec": 2.0, "max_sec": 12.0},
        }
        quality_mode = request.qualityPreset if request.qualityPreset in quality_profiles else "balanced"
        profile = quality_profiles[quality_mode]

        source_clip_dirs = collect_source_clip_dirs()

        if request.acceptedOnly and request.sourceMode != "target_dataset":
            review_dirs = sorted({p for p in streamer_root.rglob("clips_review") if p.is_dir()}, reverse=True)
            if review_dirs:
                source_clip_dirs = list(review_dirs)

        def collect_candidates(clip_dirs: list[Path]) -> list[dict]:
            candidates: list[dict] = []
            for clip_dir in clip_dirs:
                for clip_path in sorted(clip_dir.glob("*.wav")):
                    try:
                        duration = float(sf.info(str(clip_path)).duration)
                    except Exception:
                        duration = 0.0
                    candidates.append({
                        "path": clip_path.resolve(),
                        "group": str(clip_dir.resolve()),
                        "duration": duration,
                    })
            return candidates

        candidates = collect_candidates(source_clip_dirs)
        if not candidates:
            raise HTTPException(status_code=404, detail="No speaker clips found for selected TTS source")

        filtered = [
            item for item in candidates
            if profile["min_sec"] <= item["duration"] <= profile["max_sec"]
        ]
        pool = filtered if filtered else candidates

        grouped: dict[str, list[dict]] = defaultdict(list)
        for item in pool:
            grouped[item["group"]].append(item)
        for group_items in grouped.values():
            group_items.sort(key=lambda x: abs(float(x["duration"]) - 4.0))

        group_keys = sorted(grouped.keys())
        selected: list[dict] = []
        clip_target = int(profile["clip_count"])

        while len(selected) < clip_target and group_keys:
            next_group_keys: list[str] = []
            for group_key in group_keys:
                if len(selected) >= clip_target:
                    break
                bucket = grouped[group_key]
                if not bucket:
                    continue
                selected.append(bucket.pop(0))
                if bucket:
                    next_group_keys.append(group_key)
            group_keys = next_group_keys

        if len(selected) < clip_target:
            selected_paths = {str(item["path"]) for item in selected}
            remaining = sorted(pool, key=lambda x: abs(float(x["duration"]) - 4.0))
            for item in remaining:
                if len(selected) >= clip_target:
                    break
                key = str(item["path"])
                if key in selected_paths:
                    continue
                selected.append(item)
                selected_paths.add(key)

        if not selected:
            raise HTTPException(status_code=500, detail="Failed to select speaker clips for TTS")

        temp_dataset_root = (WORKSPACE_ROOT / "temp" / "tts" / streamer_slug / datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")).resolve()
        temp_clips_dir = temp_dataset_root / "clips"
        temp_clips_dir.mkdir(parents=True, exist_ok=True)

        prepared_paths: list[Path] = []
        for idx, item in enumerate(selected, 1):
            src_path = Path(item["path"])
            dst_path = temp_clips_dir / f"{idx:04d}_{src_path.name}"
            try:
                os.link(src_path, dst_path)
            except Exception:
                shutil.copy2(src_path, dst_path)
            prepared_paths.append(dst_path)

        streamer_dataset = temp_dataset_root

        clips_dir = streamer_dataset / "clips"
        if not clips_dir.exists():
            raise HTTPException(status_code=404, detail="No clips directory found in dataset")

        # Output path under out/<streamer>/tts
        tts_dir = (out_root / request.streamer / "tts").resolve()
        tts_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_path = (tts_dir / f"tts_{request.streamer}_{timestamp}.wav").resolve()

        # Call the PowerShell TTS script
        ps_script = Path(settings.tts_script_path).resolve() if settings.tts_script_path else (WORKSPACE_ROOT / "scripts" / "tts-generate.ps1")
        if not ps_script.exists():
            raise HTTPException(
                status_code=500,
                detail=(
                    f"TTS generation script not found: {ps_script}. "
                    "Step 7 requires an external XTTS generation script. "
                    "Current pipeline prepares dataset clips in Step 6 but does not train a model checkpoint by itself."
                ),
            )

        cmd = [
            "pwsh",
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", str(ps_script),
            "-Text", request.text,
            "-SpeakerDataset", str(streamer_dataset),
            "-SpeakerClipCount", str(len(prepared_paths)),
            "-OutputFile", str(output_path),
            "-Model", "xtts_v2",
            "-Language", "en"
        ]

        if not request.stream:
            log_buffer = []

            def add_log(msg: str):
                timestamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
                entry = f"[{timestamp}] {msg}"
                log_buffer.append(entry)

            add_log("Starting TTS generation...")
            add_log(f"Streamer dataset: {streamer_dataset}")
            add_log(f"Clips dir: {clips_dir}")
            add_log(
                f"TTS options: sourceMode={request.sourceMode} quality={quality_mode} "
                f"acceptedOnly={request.acceptedOnly} selectedClips={len(prepared_paths)}"
            )
            add_log(f"Text: {request.text}")
            add_log(f"Output: {output_path}")
            add_log(f"Running: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=600,
            )

            if result.stdout:
                for line in result.stdout.split('\n'):
                    if line.strip():
                        add_log(line.strip())
            if result.stderr:
                for line in result.stderr.split('\n'):
                    if line.strip():
                        add_log(f"stderr: {line.strip()}")

            if result.returncode != 0:
                error_msg = result.stderr or "TTS generation failed"
                add_log(f"ERROR: {error_msg}")
                shutil.rmtree(streamer_dataset, ignore_errors=True)
                raise HTTPException(status_code=500, detail=error_msg)

            if not output_path.exists():
                add_log("TTS process completed but output file missing")
                err_tail = None
                if result.stderr:
                    lines = [ln for ln in result.stderr.split("\n") if ln.strip()]
                    err_tail = lines[-1] if lines else None
                shutil.rmtree(streamer_dataset, ignore_errors=True)
                raise HTTPException(status_code=500, detail=err_tail or "TTS output file not created")

            add_log(f"TTS generated successfully: {output_path}")

            refresh_datasets_index(dataset_root, out_root, WORKSPACE_ROOT)
            shutil.rmtree(streamer_dataset, ignore_errors=True)

            return RunTtsResponse(
                outputPath=to_workspace_relative(output_path),
                exitCode=result.returncode,
                log=log_buffer,
            )

        # Streaming mode
        async def stream_logs():
            start = datetime.datetime.utcnow().strftime("%H:%M:%S")
            yield json.dumps({"type": "log", "line": f"[{start}] Starting TTS generation..."}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Streamer dataset: {streamer_dataset}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Clips dir: {clips_dir}"}) + "\n"
            yield json.dumps({
                "type": "log",
                "line": (
                    f"[{start}] TTS options: sourceMode={request.sourceMode} quality={quality_mode} "
                    f"acceptedOnly={request.acceptedOnly} selectedClips={len(prepared_paths)}"
                ),
            }) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Text: {request.text}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Output: {output_path}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Running: {' '.join(cmd)}"}) + "\n"

            events: queue.Queue[object] = queue.Queue()
            sentinel = object()

            def worker() -> None:
                try:
                    process = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                    )

                    if process.stdout is not None:
                        for line in process.stdout:
                            clean = line.rstrip("\r\n")
                            if clean:
                                events.put(json.dumps({"type": "log", "line": clean}))

                    code = process.wait()

                    if code != 0:
                        events.put(json.dumps({
                            "type": "error",
                            "exitCode": code,
                            "error": f"TTS generation failed (code={code})",
                        }))
                        return

                    if not output_path.exists():
                        events.put(json.dumps({
                            "type": "error",
                            "exitCode": code,
                            "error": f"TTS output missing (code={code})",
                        }))
                        return

                    events.put(json.dumps({
                        "type": "done",
                        "exitCode": code,
                        "outputPath": to_workspace_relative(output_path),
                    }))
                except Exception as exc:
                    events.put(json.dumps({"type": "error", "error": f"TTS streaming failed: {exc}"}))
                finally:
                    shutil.rmtree(streamer_dataset, ignore_errors=True)
                    events.put(sentinel)

            thread = threading.Thread(target=worker, daemon=True)
            thread.start()

            while True:
                item = await asyncio.to_thread(events.get)
                if item is sentinel:
                    break
                yield f"{item}\n"

        return StreamingResponse(stream_logs(), media_type="application/x-ndjson")

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="TTS generation timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {exc}")


@router.get("/datasets/streamers", response_model=StreamerDatasetSummaryListResponse)
async def list_dataset_streamers(
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = get_datasets_index(dataset_root, out_root, WORKSPACE_ROOT, refresh=refresh)
    summaries = summarize_streamers(records)
    return StreamerDatasetSummaryListResponse(
        items=[StreamerDatasetSummaryResponse(**item) for item in summaries],
        total=len(summaries),
    )


@router.get("/datasets", response_model=DatasetListResponse)
async def list_datasets(
    streamer: str | None = Query(None),
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = get_datasets_index(dataset_root, out_root, WORKSPACE_ROOT, refresh=refresh)
    if streamer:
        records = [item for item in records if str(item.get("streamer", "")).lower() == streamer.lower()]
    return DatasetListResponse(
        items=[DatasetRecordResponse(**item) for item in records],
        total=len(records),
    )


@router.get("/datasets/{dataset_id}", response_model=DatasetRecordResponse)
async def get_dataset_record(
    dataset_id: str,
    datasetOut: str = Query("dataset"),
    outdir: str = Query("out"),
    refresh: bool = Query(False),
):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = get_datasets_index(dataset_root, out_root, WORKSPACE_ROOT, refresh=refresh)
    match = next((item for item in records if item.get("datasetId") == dataset_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetRecordResponse(**match)


# Job Management Routes

@router.post("/jobs")
async def create_job(request: CreateJobRequest) -> JobResponse:
    """Create a legacy job entry for the wizard."""
    from streamcraft.jobs.storage import create_job as create_job_storage

    streamer = (request.streamer or "unknown").strip() or "unknown"
    title = (request.title or "Untitled").strip() or "Untitled"
    return create_job_storage(request.vodUrl, streamer=streamer, title=title)

@router.get("/jobs")
async def get_jobs() -> list[JobResponse]:
    """Get all jobs."""
    from streamcraft.jobs.storage import get_all_jobs
    return get_all_jobs()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobResponse:
    """Get a single job by ID."""
    from streamcraft.jobs.storage import get_job as get_job_by_id
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, request: UpdateJobRequest) -> JobResponse:
    """Update a job."""
    from streamcraft.jobs.storage import update_job as update_job_storage
    job = update_job_storage(job_id, steps=request.steps, outputs=request.outputs)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> dict:
    """Delete a job."""
    from streamcraft.jobs.storage import delete_job as delete_job_storage
    success = delete_job_storage(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "deleted"}


@router.delete("/jobs/{job_id}/purge")
async def purge_job(job_id: str) -> dict:
    """Delete a job and remove its VOD artifacts."""
    from streamcraft.jobs.storage import delete_job as delete_job_storage
    from streamcraft.jobs.storage import get_job as get_job_storage
    from streamcraft.core.pipeline import resolve_output_dirs

    job = get_job_storage(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    out_root = Path("out")
    dataset_root = Path("dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(job.vodUrl, out_root, dataset_root)

    removed: list[str] = []
    if vod_dir.exists():
        shutil.rmtree(vod_dir, ignore_errors=True)
        removed.append(to_workspace_relative(vod_dir))

    vod_slug = vod_dir.name
    segment_manifest = dataset_dir / f"{vod_slug}_segments.json"
    review_manifest = dataset_dir / f"{vod_slug}_segment_review.json"
    for path in (segment_manifest, review_manifest):
        if path.exists():
            try:
                path.unlink()
                removed.append(to_workspace_relative(path))
            except Exception:
                pass

    delete_job_storage(job_id)
    return {"status": "deleted", "removed": removed}


def resolve_artifact_path(path_value: str) -> Path:
    candidate = Path(path_value)
    if not candidate.is_absolute():
        candidate = (WORKSPACE_ROOT / candidate).resolve()
    else:
        candidate = candidate.resolve()
    try:
        candidate.relative_to(WORKSPACE_ROOT)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path outside workspace")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return candidate


def to_workspace_relative(path_value: Path) -> str:
    resolved = path_value.resolve(strict=False)
    try:
        rel = resolved.relative_to(WORKSPACE_ROOT)
    except ValueError:
        rel = resolved
    return rel.as_posix()


@router.api_route("/artifact", methods=["GET", "HEAD"])
async def get_artifact(path: str = Query(..., description="Relative path to fetch under workspace")):
    target = resolve_artifact_path(path)
    media_type = "application/octet-stream"
    if target.suffix.lower() == ".wav":
        media_type = "audio/wav"
    return FileResponse(target, media_type=media_type, filename=target.name)
