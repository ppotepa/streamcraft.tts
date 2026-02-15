"""Dataset route handlers."""

import asyncio
import datetime
import json
import queue
import threading
from pathlib import Path

from fastapi import HTTPException

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import WORKSPACE_ROOT, to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.jobs.datasets_index import get_datasets_index, refresh_datasets_index, summarize_streamers
from streamcraft.models.api import (
    DatasetListResponse,
    DatasetRecordResponse,
    RunTrainRequest,
    RunTrainResponse,
    StreamerDatasetSummaryListResponse,
    StreamerDatasetSummaryResponse,
)


async def run_dataset_build(request: RunTrainRequest):
    """Build dataset artifacts from sanitize segments + review + ASR overlap."""
    try:
        import subprocess

        from streamcraft.core.corpus_index import upsert_run_into_corpus
        from streamcraft.core.dataset_builder_v2 import build_dataset_from_run
        from streamcraft.core.pipeline import configure_temp_dir, resolve_output_dirs

        configure_temp_dir(Path.cwd())

        run_id = require_run_id_or_400(request.runId, "/dataset/build")
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

        def add_log(message: str) -> None:
            stamp = datetime.datetime.now(datetime.UTC).strftime("%H:%M:%S")
            log_buffer.append(f"[{stamp}] {message}")

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
                    command = [
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
                    subprocess.run(command, check=True, capture_output=True)
                    log_writer(f"Exported AAC reference -> {aac_path}")
                except Exception as exc:
                    log_writer(f"WARN: AAC export failed: {exc}")

            clip_count = len(list(clips_dir.glob("*.wav"))) + len(list(clips_dir.glob("*.m4a")))
            log_writer(f"Clip count: {clip_count}")
            log_writer("[progress] 90% Refreshing datasets index")

            refresh_datasets_index(dataset_root, out_root, WORKSPACE_ROOT)
            merge_run_stage_artifacts(
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

        def stream_log(message: str) -> None:
            add_log(message)
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

        from fastapi.responses import StreamingResponse

        return StreamingResponse(iterator(), media_type="application/x-ndjson")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Dataset build failed: {exc}")


async def list_dataset_streamers(datasetOut: str = "dataset", outdir: str = "out", refresh: bool = False):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
    summaries = await asyncio.to_thread(summarize_streamers, records)
    return StreamerDatasetSummaryListResponse(
        items=[StreamerDatasetSummaryResponse(**item) for item in summaries],
        total=len(summaries),
    )


async def list_datasets(streamer: str | None = None, datasetOut: str = "dataset", outdir: str = "out", refresh: bool = False):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
    if streamer:
        records = [item for item in records if str(item.get("streamer", "")).lower() == streamer.lower()]
    return DatasetListResponse(items=[DatasetRecordResponse(**item) for item in records], total=len(records))


async def get_dataset_record(dataset_id: str, datasetOut: str = "dataset", outdir: str = "out", refresh: bool = False):
    dataset_root = Path(datasetOut or "dataset")
    out_root = Path(outdir or "out")
    records = await asyncio.to_thread(get_datasets_index, dataset_root, out_root, WORKSPACE_ROOT, refresh)
    match = next((item for item in records if item.get("datasetId") == dataset_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetRecordResponse(**match)
