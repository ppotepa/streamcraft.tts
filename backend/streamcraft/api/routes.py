"""API routes for the wizard."""

import datetime
import json
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

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
    SaveSegmentReviewRequest,
    SaveSegmentReviewResponse,
    GetSegmentReviewResponse,
    SegmentReviewVote,
    ExportClipsRequest,
    ExportClipsResponse,
    ExportClipItem,
)

router = APIRouter()
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]


@router.post("/vod/check")
async def check_vod(vod_url: str = Query(...)) -> VodMetaResponse:
    """Check VOD and return metadata from Twitch."""
    
    try:
        # Import inside try to catch missing twitchdl gracefully
        from twitchdl import twitch, utils  # type: ignore
        
        if not vod_url.startswith("http"):
            raise HTTPException(status_code=400, detail="Only Twitch URLs supported for metadata fetch")
        
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
        from streamcraft.core.transcribe import download_vod, extract_audio

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

        log("Ensuring VOD media is ready...")
        download_target = download_vod(vod_url, vod_dir)
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
        from streamcraft.core.pipeline import configure_temp_dir
        from streamcraft.core.sanitize import SanitizeSettings, run_sanitize_job

        configure_temp_dir(Path.cwd())

        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        settings = SanitizeSettings(
            silence_threshold_db=request.silenceThresholdDb,
            min_segment_ms=request.minSegmentMs,
            merge_gap_ms=request.mergeGapMs,
            target_peak_db=request.targetPeakDb,
            fade_ms=request.fadeMs,
        )

        (
            clean_path,
            manifest_path,
            preview_path,
            segments,
            sr,
            preview_sr,
            raw_log,
        ) = run_sanitize_job(
            request.vodUrl,
            out_root,
            dataset_root,
            settings,
        )

        total_duration = sum(seg.duration for seg in segments)

        timestamped_log = []
        now = datetime.datetime.utcnow()
        for idx, line in enumerate(raw_log):
            stamp = (now + datetime.timedelta(seconds=idx)).strftime("%H:%M:%S")
            timestamped_log.append(f"[{stamp}] {line}")

        return RunSanitizeResponse(
            cleanPath=to_workspace_relative(clean_path),
            segmentsPath=to_workspace_relative(manifest_path),
            segments=len(segments),
            cleanDuration=total_duration,
            previewSegments=[
                {
                    "start": seg.start,
                    "end": seg.end,
                    "duration": seg.duration,
                    "rmsDb": seg.rms_db,
                }
                for seg in segments[:500]
            ],
            previewPath=to_workspace_relative(preview_path),
            previewSampleRate=preview_sr,
            exitCode=0,
            log=timestamped_log,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Sanitize failed: {exc}")


def _segment_review_path(vod_url: str, out_root: Path, dataset_root: Path) -> Path:
    from streamcraft.core.pipeline import resolve_output_dirs

    _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root)
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
    """Transcribe audio to SRT."""
    # TODO: Implement actual transcription as background job
    return RunSrtResponse(
        path="out/demo/vods/123456/123456.srt",
        lines=100,
        excerpt="1\n00:00:00,000 --> 00:00:05,000\nHello world\n\n2\n00:00:05,000 --> 00:00:10,000\nThis is a test",
        exitCode=0,
        log=["[i] Transcribing...", "[OK] Transcribed 100 segments"],
    )


@router.post("/tts/run")
async def run_tts(request: RunTtsRequest) -> RunTtsResponse:
    """Generate TTS output."""
    # TODO: Implement actual TTS generation as background job
    return RunTtsResponse(
        outputPath="output/demo/tts/output.wav",
        exitCode=0,
        log=["[i] Generating...", "[OK] Generated"],
    )


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


@router.get("/artifact")
async def get_artifact(path: str = Query(..., description="Relative path to fetch under workspace")):
    target = resolve_artifact_path(path)
    media_type = "application/octet-stream"
    if target.suffix.lower() == ".wav":
        media_type = "audio/wav"
    return FileResponse(target, media_type=media_type, filename=target.name)
