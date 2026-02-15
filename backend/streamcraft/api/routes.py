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
    RunDiarizationRequest,
    RunDiarizationResponse,
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
    ModelTrainRequest,
    ModelTrainResponse,
    ModelTrainJobResponse,
    ModelTrainJobListResponse,
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


def _require_run_id(run_id: str | None, route_name: str) -> str:
    value = (run_id or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail=f"runId is required for {route_name}")
    return value


def _merge_run_stage_artifacts(
    *,
    vod_url: str,
    out_root: Path,
    dataset_root: Path,
    run_id: str,
    stage: str,
    payload: dict,
) -> None:
    from streamcraft.core.pipeline import resolve_output_dirs, describe_vod, slugify_label

    streamer, vod_identifier = describe_vod(vod_url)
    streamer_slug = slugify_label(streamer, "unknown")
    _, _, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = dataset_dir / "run_metadata.json"

    now = datetime.datetime.utcnow().isoformat()
    current: dict = {}
    if metadata_path.exists():
        try:
            current = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            current = {}

    if not current:
        current = {
            "run_id": run_id,
            "created_at": now,
            "vod_url": vod_url,
            "streamer": streamer_slug,
            "vod_identifier": vod_identifier,
            "status": "in_progress",
            "params": {},
            "stats": {},
        }

    artifacts = current.setdefault("artifacts", {})
    artifacts[stage] = payload
    current["updated_at"] = now
    metadata_path.write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")


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

        video = await asyncio.to_thread(twitch.get_video, vid)
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
        run_id = _require_run_id(request.runId, "/audio/run")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        _, vod_dir, _ = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
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
        download_target = await asyncio.to_thread(
            download_with_fallback,
            vod_url,
            vod_dir,
            quality,
            auth_token,
        )
        log(f"VOD ready at {download_target}")

        log("Extracting PCM audio via ffmpeg...")
        audio_full, _ = await asyncio.to_thread(extract_audio, download_target, vod_dir)
        log(f"Audio ready {audio_full}")

        _merge_run_stage_artifacts(
            vod_url=vod_url,
            out_root=out_root,
            dataset_root=dataset_root,
            run_id=run_id,
            stage="audio",
            payload={
                "mediaPath": to_workspace_relative(download_target),
                "audioFullPath": to_workspace_relative(audio_full),
            },
        )

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

        run_id = _require_run_id(request.runId, "/sanitize/run")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, _, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

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
                        run_id=run_id,
                    )
                    _merge_run_stage_artifacts(
                        vod_url=request.vodUrl,
                        out_root=out_root,
                        dataset_root=dataset_root,
                        run_id=run_id,
                        stage="sanitize",
                        payload={
                            "cleanPath": to_workspace_relative(result.clean_path),
                            "segmentsPath": to_workspace_relative(result.manifest_path),
                            "previewPath": to_workspace_relative(result.preview_path),
                            "segments": len(result.segments),
                        },
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

        result = await asyncio.to_thread(
            run_sanitise_v2,
            request.vodUrl,
            out_root,
            dataset_root,
            cfg,
            should_cancel=cancel_event.is_set if cancel_event else None,
            run_id=run_id,
        )

        _merge_run_stage_artifacts(
            vod_url=request.vodUrl,
            out_root=out_root,
            dataset_root=dataset_root,
            run_id=run_id,
            stage="sanitize",
            payload={
                "cleanPath": to_workspace_relative(result.clean_path),
                "segmentsPath": to_workspace_relative(result.manifest_path),
                "previewPath": to_workspace_relative(result.preview_path),
                "segments": len(result.segments),
            },
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


@router.post("/diarization/run")
async def run_diarization(request: RunDiarizationRequest) -> RunDiarizationResponse:
    """Run diarization for target-speaker filtering and save labels under run/asr."""
    from streamcraft.core.pipeline import resolve_output_dirs

    run_id = _require_run_id(request.runId, "/diarization/run")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
    vod_slug = vod_dir.name

    clean_audio = vod_dir / f"{vod_slug}_clean.wav"
    if not clean_audio.exists():
        raise HTTPException(status_code=400, detail="Clean audio missing; run sanitize first")

    asr_dir = dataset_dir / "asr"
    asr_dir.mkdir(parents=True, exist_ok=True)
    labels_path = asr_dir / "diarization.json"

    settings = get_settings()
    script = (settings.diarization_script_path or "").strip()
    if not script:
        # minimal fallback artifact to keep pipeline operational when diarization is not configured
        labels_payload = {
            "status": "unavailable",
            "reason": "STREAMCRAFT_DIARIZATION_SCRIPT_PATH not configured",
            "segments": [],
        }
        labels_path.write_text(json.dumps(labels_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        _merge_run_stage_artifacts(
            vod_url=request.vodUrl,
            out_root=out_root,
            dataset_root=dataset_root,
            run_id=run_id,
            stage="diarization",
            payload={"labelsPath": to_workspace_relative(labels_path), "status": "unavailable", "speakerCount": 0},
        )
        return RunDiarizationResponse(
            labelsPath=to_workspace_relative(labels_path),
            speakerCount=0,
            exitCode=0,
            log=["Diarization script not configured; wrote unavailable marker"],
        )

    script_path = Path(script)
    if not script_path.is_absolute():
        script_path = (WORKSPACE_ROOT / script_path).resolve()
    if not script_path.exists():
        raise HTTPException(status_code=500, detail=f"Diarization script not found: {script_path}")

    cmd = [
        "pwsh",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        "-InputAudio",
        str(clean_audio),
        "-OutputJson",
        str(labels_path),
    ]

    result = await asyncio.to_thread(
        subprocess.run,
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    log_lines = []
    if result.stdout:
        log_lines.extend([line for line in result.stdout.splitlines() if line.strip()])
    if result.stderr:
        log_lines.extend([f"stderr: {line}" for line in result.stderr.splitlines() if line.strip()])
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Diarization failed")
    if not labels_path.exists():
        raise HTTPException(status_code=500, detail="Diarization output not created")

    labels = json.loads(labels_path.read_text(encoding="utf-8"))
    speakers = {entry.get("speaker") for entry in labels.get("segments") or [] if entry.get("speaker")}
    _merge_run_stage_artifacts(
        vod_url=request.vodUrl,
        out_root=out_root,
        dataset_root=dataset_root,
        run_id=run_id,
        stage="diarization",
        payload={"labelsPath": to_workspace_relative(labels_path), "status": "done", "speakerCount": len(speakers)},
    )
    return RunDiarizationResponse(
        labelsPath=to_workspace_relative(labels_path),
        speakerCount=len(speakers),
        exitCode=0,
        log=log_lines[-400:],
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
    event = _get_sanitize_cancel_event(job_id)
    event.set()
    return {"status": "cancel-requested"}


def _segment_review_path(vod_url: str, out_root: Path, dataset_root: Path, run_id: str) -> Path:
    from streamcraft.core.pipeline import resolve_output_dirs

    _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
    vod_slug = vod_dir.name
    return dataset_dir / f"{vod_slug}_segment_review.json"


def _load_review_payload(review_path: Path) -> dict:
    if not review_path.exists():
        raise FileNotFoundError("Segment review not found; run swipe review first")
    try:
        return json.loads(review_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted review file: {exc}")


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
    runId: str = Query(..., description="Run identifier"),
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
) -> SegmentManifestResponse:
    from streamcraft.core.pipeline import resolve_output_dirs
    from streamcraft.core.dataset import parse_srt

    out_root = Path(outdir or "out")
    dataset_root = Path(datasetOut or "dataset")
    run_id = _require_run_id(runId, "/sanitize/segments")
    _, vod_dir, dataset_dir = resolve_output_dirs(vodUrl, out_root, dataset_root, run_id=run_id)
    
    manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
    
    payload = _load_manifest(manifest_path)
    
    # Load SRT for transcription text
    srt_path = dataset_dir / "asr" / f"{vod_dir.name}.srt"
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


@router.post("/dataset/build")
async def run_dataset_build(request: RunTrainRequest) -> RunTrainResponse:
    """Build dataset artifacts from sanitize segments + review + ASR overlap."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs, configure_temp_dir
        from streamcraft.core.dataset_builder_v2 import build_dataset_from_run
        from streamcraft.core.corpus_index import upsert_run_into_corpus
        import subprocess

        configure_temp_dir(Path.cwd())

        run_id = _require_run_id(request.runId, "/dataset/build")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        streamer_slug, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
        vod_slug = vod_dir.name

        clean_audio = vod_dir / f"{vod_slug}_clean.wav"
        sanitize_manifest = dataset_dir / f"{vod_slug}_segments.json"
        review_path = dataset_dir / f"{vod_slug}_segment_review.json"
        srt_path = dataset_dir / "asr" / f"{vod_slug}.srt"
        diarization_labels = dataset_dir / "asr" / "diarization.json"
        clips_dir = dataset_dir / "clips"
        manifest_jsonl = dataset_dir / "manifest.jsonl"
        segments_json = dataset_dir / "dataset_segments.json"

        if not clean_audio.exists():
            raise HTTPException(status_code=400, detail="Clean audio missing; run Sanitize first")
        if not sanitize_manifest.exists():
            raise HTTPException(status_code=400, detail="Sanitize manifest missing; run Sanitize first")
        if not srt_path.exists():
            raise HTTPException(status_code=400, detail="ASR SRT missing in run/asr; run SRT first")

        log_buffer: list[str] = []

        def add_log(msg: str):
            stamp = datetime.datetime.utcnow().strftime("%H:%M:%S")
            log_buffer.append(f"[{stamp}] {msg}")

        def execute_build(log_writer) -> dict:
            log_writer(f"Streamer bucket: {streamer_slug}")
            log_writer(f"Dataset dir: {dataset_dir}")
            log_writer(f"Input audio: {clean_audio}")
            log_writer(f"Sanitize manifest: {sanitize_manifest}")
            log_writer(f"ASR SRT: {srt_path}")
            log_writer("[progress] 10% Preparing dataset build")

            result = build_dataset_from_run(
                run_dir=dataset_dir,
                vod_slug=vod_slug,
                clean_audio_path=clean_audio,
                sanitize_manifest_path=sanitize_manifest,
                review_path=review_path if review_path.exists() else None,
                asr_srt_path=srt_path,
                diarization_labels_path=diarization_labels if diarization_labels.exists() else None,
                target_speaker=request.targetSpeaker,
                max_clip_sec=float(request.maxClipSec),
                min_speaker_sim=float(request.minSpeakerSim or 0.0),
                force=request.force,
            )

            log_writer("[progress] 70% Dataset clips built")

            corpus_db_path = dataset_root / streamer_slug / "corpus" / "clip_index.sqlite"
            indexed = upsert_run_into_corpus(
                corpus_db_path=corpus_db_path,
                streamer_slug=streamer_slug,
                run_id=run_id,
                run_dir=dataset_dir,
                manifest_jsonl_path=result.manifest_jsonl,
            )
            log_writer(f"Corpus index updated: {indexed} new/updated rows")

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
            _merge_run_stage_artifacts(
                vod_url=request.vodUrl,
                out_root=out_root,
                dataset_root=dataset_root,
                run_id=run_id,
                stage="dataset",
                payload={
                    "datasetPath": to_workspace_relative(dataset_dir),
                    "clipsDir": to_workspace_relative(result.clips_dir),
                    "manifestPath": to_workspace_relative(result.manifest_jsonl),
                    "segmentsPath": to_workspace_relative(result.segments_json),
                    "clipsCount": result.exported_count,
                },
            )
            log_writer("[progress] 100% Dataset build complete")

            return {
                "datasetPath": to_workspace_relative(dataset_dir),
                "clipsDir": to_workspace_relative(clips_dir),
                "manifestPath": to_workspace_relative(manifest_jsonl),
                "segmentsPath": to_workspace_relative(segments_json),
                "exitCode": 0,
                "log": log_buffer,
            }

        if not request.stream:
            payload = await asyncio.to_thread(execute_build, add_log)
            return RunTrainResponse(**payload)

        events: queue.Queue[object] = queue.Queue()
        sentinel = object()

        def stream_log(msg: str) -> None:
            add_log(msg)
            events.put(json.dumps({"type": "log", "line": log_buffer[-1]}))

        def worker() -> None:
            try:
                payload = execute_build(stream_log)
                events.put(json.dumps({"type": "done", "result": payload}))
            except Exception as exc:
                events.put(json.dumps({"type": "error", "error": f"Dataset build failed: {exc}"}))
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
        raise HTTPException(status_code=500, detail=f"Dataset build failed: {exc}")


@router.post("/model/train")
async def run_model_train(request: ModelTrainRequest) -> ModelTrainResponse:
    """Queue a real model training job and return checkpoint metadata."""
    from streamcraft.core.pipeline import resolve_output_dirs, generate_run_id
    from streamcraft.jobs.model_training import enqueue_training_job

    run_id = _require_run_id(request.runId, "/model/train")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    model_root = Path(request.modelOut or "models")

    streamer_slug, _, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
    manifest_jsonl = dataset_dir / "manifest.jsonl"
    if not manifest_jsonl.exists():
        raise HTTPException(status_code=400, detail="manifest.jsonl missing; run /dataset/build first")

    checkpoint_id = generate_run_id()
    checkpoint_dir = model_root / streamer_slug / checkpoint_id
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = checkpoint_dir / "training_manifest.json"

    payload = {
        "checkpointId": checkpoint_id,
        "status": "queued",
        "runId": run_id,
        "vodUrl": request.vodUrl,
        "streamer": streamer_slug,
        "baseModel": request.baseModel,
        "epochs": request.epochs,
        "datasetManifest": to_workspace_relative(manifest_jsonl),
        "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
        "note": "queued for training worker",
    }
    metadata_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    job = enqueue_training_job(
        run_id=run_id,
        vod_url=request.vodUrl,
        streamer_slug=streamer_slug,
        checkpoint_id=checkpoint_id,
        checkpoint_dir=checkpoint_dir,
        metadata_path=metadata_path,
        dataset_manifest=manifest_jsonl,
        base_model=request.baseModel,
        epochs=request.epochs,
    )

    _merge_run_stage_artifacts(
        vod_url=request.vodUrl,
        out_root=out_root,
        dataset_root=dataset_root,
        run_id=run_id,
        stage="modelTrain",
        payload={
            "jobId": job["id"],
            "checkpointId": checkpoint_id,
            "checkpointPath": to_workspace_relative(checkpoint_dir),
            "metadataPath": to_workspace_relative(metadata_path),
            "status": "queued",
        },
    )

    return ModelTrainResponse(
        jobId=str(job["id"]),
        checkpointId=checkpoint_id,
        status="queued",
        checkpointPath=to_workspace_relative(checkpoint_dir),
        metadataPath=to_workspace_relative(metadata_path),
        log=[f"Training job queued: {job['id']}", "Checkpoint metadata created"],
    )


def _to_model_train_job_response(job: dict) -> ModelTrainJobResponse:
    return ModelTrainJobResponse(
        id=str(job.get("id")),
        status=str(job.get("status") or "queued"),
        createdAt=str(job.get("created_at") or ""),
        updatedAt=str(job.get("updated_at") or ""),
        runId=str(job.get("run_id") or ""),
        vodUrl=str(job.get("vod_url") or ""),
        streamer=str(job.get("streamer_slug") or ""),
        checkpointId=str(job.get("checkpoint_id") or ""),
        checkpointPath=to_workspace_relative(Path(str(job.get("checkpoint_dir") or ""))),
        metadataPath=to_workspace_relative(Path(str(job.get("metadata_path") or ""))),
        datasetManifest=to_workspace_relative(Path(str(job.get("dataset_manifest") or ""))),
        progress=int(job.get("progress") or 0),
        error=job.get("error"),
        log=list(job.get("log") or []),
    )


@router.get("/model/train/jobs", response_model=ModelTrainJobListResponse)
async def list_model_train_jobs(limit: int = Query(50, ge=1, le=200)) -> ModelTrainJobListResponse:
    from streamcraft.jobs.model_training import list_training_jobs

    jobs = await asyncio.to_thread(list_training_jobs, limit)
    items = [_to_model_train_job_response(job) for job in jobs]
    return ModelTrainJobListResponse(items=items, total=len(items))


@router.get("/model/train/jobs/{job_id}", response_model=ModelTrainJobResponse)
async def get_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import get_training_job

    job = await asyncio.to_thread(get_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)


@router.post("/model/train/jobs/{job_id}/cancel", response_model=ModelTrainJobResponse)
async def cancel_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import cancel_training_job, get_training_job

    ok = await asyncio.to_thread(cancel_training_job, job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Model training job not found")
    job = await asyncio.to_thread(get_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)


@router.post("/model/train/jobs/{job_id}/retry", response_model=ModelTrainJobResponse)
async def retry_model_train_job(job_id: str) -> ModelTrainJobResponse:
    from streamcraft.jobs.model_training import retry_training_job

    job = await asyncio.to_thread(retry_training_job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Model training job not found")
    return _to_model_train_job_response(job)


@router.get("/sanitize/review")
async def get_segment_review(
    vodUrl: str = Query(..., description="VOD URL the review belongs to"),
    outdir: str = Query("out"),
    datasetOut: str = Query("dataset"),
    runId: str = Query(..., description="Run identifier"),
) -> GetSegmentReviewResponse:
    out_root = Path(outdir or "out")
    dataset_root = Path(datasetOut or "dataset")
    run_id = _require_run_id(runId, "/sanitize/review")
    review_path = _segment_review_path(vodUrl, out_root, dataset_root, run_id=run_id)
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
        payload = await asyncio.to_thread(lambda: json.loads(review_path.read_text(encoding="utf-8")))
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
    run_id = _require_run_id(request.runId, "/sanitize/review")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    review_path = _segment_review_path(request.vodUrl, out_root, dataset_root, run_id=run_id)
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

    await asyncio.to_thread(
        review_path.write_text,
        json.dumps(payload, indent=2),
        encoding="utf-8",
    )

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

    run_id = _require_run_id(request.runId, "/sanitize/export-clips")
    out_root = Path(request.outdir or "out")
    dataset_root = Path(request.datasetOut or "dataset")
    _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

    def execute_export() -> ExportClipsResponse:
        review_path = _segment_review_path(request.vodUrl, out_root, dataset_root, run_id=run_id)
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

    return await asyncio.to_thread(execute_export)


@router.post("/srt/run")
async def run_srt(request: RunSrtRequest) -> RunSrtResponse:
    """Transcribe audio to SRT using faster-whisper."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs, configure_temp_dir
        from streamcraft.core.transcribe import run_transcription

        configure_temp_dir(Path.cwd())

        run_id = _require_run_id(request.runId, "/srt/run")
        vod_url = request.vodUrl
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
        vod_dir.mkdir(parents=True, exist_ok=True)
        asr_dir = dataset_dir / "asr"
        asr_dir.mkdir(parents=True, exist_ok=True)

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
                log_writer("[warn] acceptedOnly for SRT is deprecated and ignored; ASR stays on clean/full timeline")

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

            target_srt = asr_dir / f"{vod_dir.name}.srt"
            target_txt = asr_dir / f"{vod_dir.name}.txt"
            target_meta = asr_dir / f"{vod_dir.name}.meta.json"
            shutil.copy2(srt_path, target_srt)
            txt_path = srt_path.with_suffix(".txt")
            meta_path = srt_path.with_suffix(".meta.json")
            if txt_path.exists():
                shutil.copy2(txt_path, target_txt)
            if meta_path.exists():
                shutil.copy2(meta_path, target_meta)

            _merge_run_stage_artifacts(
                vod_url=vod_url,
                out_root=out_root,
                dataset_root=dataset_root,
                run_id=run_id,
                stage="asr",
                payload={
                    "srtPath": to_workspace_relative(target_srt),
                    "txtPath": to_workspace_relative(target_txt) if target_txt.exists() else None,
                    "metaPath": to_workspace_relative(target_meta) if target_meta.exists() else None,
                    "lines": lines,
                },
            )

            return {
                "path": to_workspace_relative(target_srt),
                "lines": lines,
                "excerpt": excerpt,
                "exitCode": 0,
            }

        if not request.stream:
            result_payload = await asyncio.to_thread(execute_transcription, capture_log)
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
    from faster_whisper import WhisperModel
    
    try:
        from streamcraft.core.pipeline import resolve_output_dirs
        from streamcraft.core.transcribe import detect_device, ensure_cuda_dlls_available
        
        # Resolve paths
        run_id = _require_run_id(request.runId, "/srt/transcribe-segment")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)
        
        def prepare_segment_transcription() -> tuple[Path, WhisperModel, float]:
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

            clean_path = vod_dir / f"{vod_dir.name}_clean.wav"
            original_path = vod_dir / f"{vod_dir.name}_full.wav"
            kept = segment.get("kept", False)

            if kept and clean_path.exists():
                audio_path = clean_path
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
                    audio_path = original_path
                    start_time = float(segment.get("start", 0.0))
                    end_time = float(segment.get("end", 0.0))
            else:
                if not original_path.exists():
                    raise HTTPException(status_code=404, detail="Audio file not found")
                audio_path = original_path
                start_time = float(segment.get("start", 0.0))
                end_time = float(segment.get("end", 0.0))

            audio_data, sample_rate = sf.read(str(audio_path), always_2d=False)
            start_sample = int(start_time * sample_rate)
            end_sample = int(end_time * sample_rate)
            segment_audio = audio_data[start_sample:end_sample]

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
                sf.write(str(tmp_path), segment_audio, sample_rate)

            device, compute_type = detect_device("cuda", "float16")
            if device == "cuda":
                ensure_cuda_dlls_available()

            model = WhisperModel("base", device=device, compute_type=compute_type, cpu_threads=4)
            return tmp_path, model, duration

        tmp_path, model, duration = await asyncio.to_thread(prepare_segment_transcription)

        events: queue.Queue[object] = queue.Queue()
        sentinel = object()

        def worker() -> None:
            try:
                segments_iter, info = model.transcribe(
                    str(tmp_path),
                    language=None,
                    vad_filter=True,
                    beam_size=5,
                    word_timestamps=True,
                )
                events.put(
                    json.dumps(
                        {
                            "type": "metadata",
                            "language": info.language,
                            "duration": duration,
                        }
                    )
                )

                for seg in segments_iter:
                    if hasattr(seg, "words") and seg.words:
                        for word_info in seg.words:
                            events.put(
                                json.dumps(
                                    {
                                        "type": "word",
                                        "word": word_info.word.strip(),
                                        "start": word_info.start,
                                        "end": word_info.end,
                                        "probability": word_info.probability,
                                    }
                                )
                            )
                    else:
                        events.put(
                            json.dumps(
                                {
                                    "type": "segment",
                                    "text": seg.text.strip(),
                                    "start": seg.start,
                                    "end": seg.end,
                                }
                            )
                        )

                events.put(json.dumps({"type": "done"}))
            except Exception as exc:
                events.put(json.dumps({"type": "error", "message": str(exc)}))
            finally:
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
                events.put(sentinel)

        async def generate():
            thread = threading.Thread(target=worker, daemon=True)
            thread.start()
            while True:
                item = await asyncio.to_thread(events.get)
                if item is sentinel:
                    break
                yield f"{item}\n"

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
        from streamcraft.core.reference_selector import select_reference_clips
        import subprocess
        import shutil

        settings = get_settings()
        provider = (settings.tts_provider or "script").strip().lower()
        if provider != "script":
            raise HTTPException(
                status_code=501,
                detail=f"TTS provider '{provider}' is not implemented yet. Supported: script.",
            )

        run_id = _require_run_id(request.runId, "/tts/run")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

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
            "fast": {"target_seconds": 60.0, "max_per_run": 4, "min_speaker_sim": 0.0},
            "balanced": {"target_seconds": 90.0, "max_per_run": 6, "min_speaker_sim": 0.1},
            "best": {"target_seconds": 120.0, "max_per_run": 8, "min_speaker_sim": 0.2},
        }
        quality_mode = request.qualityPreset if request.qualityPreset in quality_profiles else "balanced"
        profile = dict(quality_profiles[quality_mode])
        if request.targetSeconds is not None:
            profile["target_seconds"] = float(max(10.0, min(600.0, request.targetSeconds)))
        if request.maxPerRun is not None:
            profile["max_per_run"] = int(max(1, min(64, request.maxPerRun)))
        if request.minSpeakerSim is not None:
            profile["min_speaker_sim"] = float(max(0.0, min(1.0, request.minSpeakerSim)))

        min_clip_sec = float(max(0.0, request.minClipSec or 0.0))
        max_clip_sec = float(max(min_clip_sec, request.maxClipSec or 0.0)) if request.maxClipSec is not None else None
        max_clips = int(max(1, min(2000, request.maxClips))) if request.maxClips is not None else None
        requested_speaker_clips = int(max(1, min(128, request.speakerClipCount))) if request.speakerClipCount is not None else None

        selected_clip_paths: list[Path] = []
        if request.sourceMode == "all_streamer" and requested_speaker_clips is None:
            corpus_db_path = streamer_root / "corpus" / "clip_index.sqlite"
            selected_refs = select_reference_clips(
                corpus_db_path=corpus_db_path,
                streamer_slug=streamer_slug,
                target_seconds=float(profile["target_seconds"]),
                max_per_run=int(profile["max_per_run"]),
                min_speaker_sim=float(profile["min_speaker_sim"]),
            )
            selected_clip_paths = [item.path for item in selected_refs]

        if not selected_clip_paths or (requested_speaker_clips is not None and len(selected_clip_paths) < requested_speaker_clips):
            source_clip_dirs = collect_source_clip_dirs()
            candidates: list[dict] = []
            for clip_dir in source_clip_dirs:
                manifest_path = clip_dir.parent / "manifest.jsonl"
                if manifest_path.exists():
                    for raw in manifest_path.read_text(encoding="utf-8").splitlines():
                        if not raw.strip():
                            continue
                        try:
                            row = json.loads(raw)
                        except Exception:
                            continue
                        clip_name = row.get("clip")
                        if not clip_name:
                            continue
                        clip_path = (clip_dir / str(clip_name)).resolve()
                        if not clip_path.exists():
                            continue
                        duration = float(row.get("duration") or 0.0)
                        if min_clip_sec and duration < min_clip_sec:
                            continue
                        if max_clip_sec is not None and duration > max_clip_sec:
                            continue
                        candidates.append(
                            {
                                "path": clip_path,
                                "score": float(row.get("score") or 0.0),
                                "duration": duration,
                            }
                        )

                for clip_path in sorted(clip_dir.glob("*.wav")):
                    resolved = clip_path.resolve()
                    if any(str(item.get("path")) == str(resolved) for item in candidates):
                        continue
                    try:
                        duration = float(sf.info(str(resolved)).duration)
                    except Exception:
                        duration = 0.0
                    if min_clip_sec and duration < min_clip_sec:
                        continue
                    if max_clip_sec is not None and duration > max_clip_sec:
                        continue
                    candidates.append({"path": resolved, "score": 0.0, "duration": duration})

            candidates.sort(
                key=lambda row: (float(row.get("score") or 0.0), float(row.get("duration") or 0.0)),
                reverse=True,
            )
            total_duration = 0.0
            seen = {str(path.resolve()) for path in selected_clip_paths}
            for row in candidates:
                if max_clips is not None and len(selected_clip_paths) >= max_clips:
                    break
                candidate_path = Path(row["path"])
                candidate_key = str(candidate_path.resolve())
                if candidate_key in seen:
                    continue
                if requested_speaker_clips is None and total_duration >= float(profile["target_seconds"]):
                    break
                if requested_speaker_clips is not None and len(selected_clip_paths) >= requested_speaker_clips:
                    break
                selected_clip_paths.append(candidate_path)
                seen.add(candidate_key)
                total_duration += float(row.get("duration") or 0.0)

        if requested_speaker_clips is not None and len(selected_clip_paths) > requested_speaker_clips:
            selected_clip_paths = selected_clip_paths[:requested_speaker_clips]

        if not selected_clip_paths:
            raise HTTPException(status_code=500, detail="Failed to select speaker clips for TTS")

        temp_dataset_root = (WORKSPACE_ROOT / "temp" / "tts" / streamer_slug / datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")).resolve()
        temp_clips_dir = temp_dataset_root / "clips"
        temp_clips_dir.mkdir(parents=True, exist_ok=True)

        prepared_paths: list[Path] = []
        for idx, src_path in enumerate(selected_clip_paths, 1):
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
            "-Model", (request.model or "xtts_v2"),
            "-Language", (request.language or "en"),
            "-Device", (request.device or "auto"),
        ]

        if request.cpuThreads is not None:
            cmd.extend(["-CpuThreads", str(int(max(1, min(64, request.cpuThreads))))])
        if request.cudaBenchmark is not None:
            cmd.extend(["-CudaBenchmark", str(bool(request.cudaBenchmark))])
        if request.temperature is not None:
            cmd.extend(["-Temperature", str(float(max(0.0, min(2.0, request.temperature))) )])
        if request.topP is not None:
            cmd.extend(["-TopP", str(float(max(0.0, min(1.0, request.topP))) )])
        if request.topK is not None:
            cmd.extend(["-TopK", str(int(max(0, min(200, request.topK))))])
        if request.speed is not None:
            cmd.extend(["-Speed", str(float(max(0.5, min(2.0, request.speed))) )])
        if request.repetitionPenalty is not None:
            cmd.extend(["-RepetitionPenalty", str(float(max(0.5, min(3.0, request.repetitionPenalty))) )])
        if request.lengthPenalty is not None:
            cmd.extend(["-LengthPenalty", str(float(max(0.2, min(3.0, request.lengthPenalty))) )])

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
                f"acceptedOnly={request.acceptedOnly} advancedMode={request.advancedMode} "
                f"selectedClips={len(prepared_paths)} targetSeconds={profile['target_seconds']}"
            )
            add_log(
                f"TTS selection: requestedSpeakerClipCount={requested_speaker_clips or 'auto'} "
                f"effectiveSpeakerClipCount={len(prepared_paths)}"
            )
            if request.advancedMode:
                add_log(
                    "TTS advanced: "
                    f"model={(request.model or 'xtts_v2')} lang={(request.language or 'en')} "
                    f"device={(request.device or 'auto')} cpuThreads={request.cpuThreads or 'auto'} "
                    f"minClipSec={request.minClipSec or 0} maxClipSec={request.maxClipSec or 'none'} maxClips={request.maxClips or 'none'}"
                )
            add_log(f"Text: {request.text}")
            add_log(f"Output: {output_path}")
            add_log(f"Running: {' '.join(cmd)}")

            result = await asyncio.to_thread(
                subprocess.run,
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

            _merge_run_stage_artifacts(
                vod_url=request.vodUrl,
                out_root=out_root,
                dataset_root=dataset_root,
                run_id=run_id,
                stage="tts",
                payload={
                    "outputPath": to_workspace_relative(output_path),
                    "selectedClips": len(prepared_paths),
                    "targetSeconds": profile["target_seconds"],
                    "sourceMode": request.sourceMode,
                },
            )

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
                    f"acceptedOnly={request.acceptedOnly} advancedMode={request.advancedMode} "
                    f"selectedClips={len(prepared_paths)} targetSeconds={profile['target_seconds']}"
                ),
            }) + "\n"
            yield json.dumps({
                "type": "log",
                "line": (
                    f"[{start}] TTS selection: requestedSpeakerClipCount={requested_speaker_clips or 'auto'} "
                    f"effectiveSpeakerClipCount={len(prepared_paths)}"
                ),
            }) + "\n"
            if request.advancedMode:
                yield json.dumps({
                    "type": "log",
                    "line": (
                        f"[{start}] TTS advanced: model={(request.model or 'xtts_v2')} lang={(request.language or 'en')} "
                        f"device={(request.device or 'auto')} cpuThreads={request.cpuThreads or 'auto'} "
                        f"minClipSec={request.minClipSec or 0} maxClipSec={request.maxClipSec or 'none'} maxClips={request.maxClips or 'none'}"
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
                    _merge_run_stage_artifacts(
                        vod_url=request.vodUrl,
                        out_root=out_root,
                        dataset_root=dataset_root,
                        run_id=run_id,
                        stage="tts",
                        payload={
                            "outputPath": to_workspace_relative(output_path),
                            "selectedClips": len(prepared_paths),
                            "targetSeconds": profile["target_seconds"],
                            "sourceMode": request.sourceMode,
                        },
                    )
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
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
    summaries = await asyncio.to_thread(summarize_streamers, records)
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
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
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
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
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
    return await asyncio.to_thread(create_job_storage, request.vodUrl, streamer, title)

@router.get("/jobs")
async def get_jobs() -> list[JobResponse]:
    """Get all jobs."""
    from streamcraft.jobs.storage import get_all_jobs
    return await asyncio.to_thread(get_all_jobs)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str) -> JobResponse:
    """Get a single job by ID."""
    from streamcraft.jobs.storage import get_job as get_job_by_id
    job = await asyncio.to_thread(get_job_by_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/jobs/{job_id}")
async def update_job(job_id: str, request: UpdateJobRequest) -> JobResponse:
    """Update a job."""
    from streamcraft.jobs.storage import update_job as update_job_storage
    job = await asyncio.to_thread(update_job_storage, job_id, request.steps, request.outputs)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str) -> dict:
    """Delete a job."""
    from streamcraft.jobs.storage import delete_job as delete_job_storage
    success = await asyncio.to_thread(delete_job_storage, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "deleted"}


@router.delete("/jobs/{job_id}/purge")
async def purge_job(job_id: str) -> dict:
    """Delete a job and remove its VOD artifacts."""
    from streamcraft.jobs.storage import delete_job as delete_job_storage
    from streamcraft.jobs.storage import get_job as get_job_storage
    from streamcraft.core.pipeline import resolve_output_dirs

    job = await asyncio.to_thread(get_job_storage, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    out_root = Path("out")
    dataset_root = Path("dataset")
    run_id = job.outputs.runId if job.outputs else None
    _, vod_dir, dataset_dir = resolve_output_dirs(job.vodUrl, out_root, dataset_root, run_id=run_id)

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

    await asyncio.to_thread(delete_job_storage, job_id)
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
