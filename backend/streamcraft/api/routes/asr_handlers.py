"""ASR route handlers."""

import asyncio
import datetime
import json
import queue
import shutil
import sys
import tempfile
import threading
from pathlib import Path

import soundfile as sf
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.api.common.review_files import load_review_payload
from streamcraft.api.common.run_scope import segment_review_path
from streamcraft.models.api import RunSrtRequest, RunSrtResponse, TranscribeSegmentRequest


async def run_srt(request: RunSrtRequest):
    """Transcribe audio to SRT using faster-whisper."""
    try:
        from streamcraft.core.pipeline import configure_temp_dir, resolve_output_dirs
        from streamcraft.core.transcribe import run_transcription

        configure_temp_dir(Path.cwd())

        run_id = require_run_id_or_400(request.runId, "/srt/run")
        vod_url = request.vodUrl
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")

        _, vod_dir, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
        vod_dir.mkdir(parents=True, exist_ok=True)
        asr_dir = dataset_dir / "asr"
        asr_dir.mkdir(parents=True, exist_ok=True)

        log_buffer: list[str] = []

        def capture_log(message: str) -> None:
            timestamp = datetime.datetime.now(datetime.UTC).strftime("%H:%M:%S")
            entry = f"[{timestamp}] {message}"
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

            merge_run_stage_artifacts(
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

        def stream_log(message: str) -> None:
            capture_log(message)
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

        traceback_text = traceback.format_exc()
        print(f"[srt] exception: {exc}\n{traceback_text}")
        last = traceback_text.strip().splitlines()[-1] if traceback_text else str(exc)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc} | {last}")


async def transcribe_segment(request: TranscribeSegmentRequest):
    """Transcribe a single segment with word-level timestamps, streaming results as NDJSON."""
    from faster_whisper import WhisperModel

    try:
        from streamcraft.core.pipeline import resolve_output_dirs
        from streamcraft.core.transcribe import detect_device, ensure_cuda_dlls_available

        run_id = require_run_id_or_400(request.runId, "/srt/transcribe-segment")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

        def prepare_segment_transcription() -> tuple[Path, WhisperModel, float]:
            clean_path = vod_dir / f"{vod_dir.name}_clean.wav"
            original_path = vod_dir / f"{vod_dir.name}_full.wav"

            manifest_candidates = [dataset_dir / f"{vod_dir.name}_segments.json", *sorted(dataset_dir.glob("*_segments.json"))]
            manifest_path = next((candidate for candidate in manifest_candidates if candidate.exists()), None)

            start_time: float | None = None
            end_time: float | None = None
            audio_path = original_path

            if manifest_path is not None:
                with open(manifest_path, "r", encoding="utf-8") as file_handle:
                    payload = json.load(file_handle)

                segments = payload.get("segments", [])
                if request.segmentIndex < 0 or request.segmentIndex >= len(segments):
                    raise HTTPException(status_code=400, detail="Invalid segment index")

                segment = segments[request.segmentIndex]
                start_time = float(segment.get("start", 0.0))
                end_time = float(segment.get("end", 0.0))
                kept = bool(segment.get("kept", False))

                if kept and clean_path.exists():
                    audio_path = clean_path
                    clean_offsets = {}
                    cursor = 0.0
                    for idx, seg in enumerate(segments):
                        if not seg.get("kept"):
                            continue
                        duration = float(seg.get("dur", 0.0))
                        clean_offsets[idx] = (cursor, cursor + duration)
                        cursor += duration

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
            else:
                review_segment: dict | None = None
                review_path = segment_review_path(request.vodUrl, out_root, dataset_root, run_id=run_id)
                try:
                    review_payload = load_review_payload(review_path)
                    review_entry = next(
                        (entry for entry in review_payload.get("votes", []) if entry.get("index") == request.segmentIndex),
                        None,
                    )
                    if review_entry:
                        review_segment = review_entry.get("segment") or {}
                except FileNotFoundError:
                    review_segment = None
                except Exception as exc:
                    raise HTTPException(status_code=500, detail=f"Failed to load segment review: {exc}")

                def _coalesce(*values):
                    for value in values:
                        if value is not None:
                            return value
                    return None

                def _to_optional_float(value):
                    if value is None:
                        return None
                    try:
                        return float(value)
                    except (TypeError, ValueError):
                        return None

                start_time = _coalesce(
                    request.segmentStart,
                    _to_optional_float(review_segment.get("start")) if review_segment else None,
                )
                end_time = _coalesce(
                    request.segmentEnd,
                    _to_optional_float(review_segment.get("end")) if review_segment else None,
                )

                if end_time is None and start_time is not None and review_segment and review_segment.get("duration") is not None:
                    end_time = float(start_time) + float(review_segment.get("duration") or 0.0)

                clean_start = _coalesce(
                    request.cleanStart,
                    _to_optional_float(review_segment.get("cleanStart")) if review_segment else None,
                )
                clean_end = _coalesce(
                    request.cleanEnd,
                    _to_optional_float(review_segment.get("cleanEnd")) if review_segment else None,
                )
                kept_flag = _coalesce(request.kept, review_segment.get("kept") if review_segment else None)

                if start_time is None or end_time is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Segment manifest not found; provide segmentStart/segmentEnd or ensure review data is available",
                    )

                if kept_flag and clean_path.exists() and clean_start is not None and clean_end is not None:
                    audio_path = clean_path
                    start_time = float(clean_start)
                    end_time = float(clean_end)
                else:
                    if not original_path.exists():
                        raise HTTPException(status_code=404, detail="Audio file not found")
                    audio_path = original_path

                start_time = float(start_time)
                end_time = float(end_time)

            if start_time is None or end_time is None:
                raise HTTPException(status_code=400, detail="Invalid segment timing")

            duration = end_time - start_time
            if duration <= 0:
                raise HTTPException(status_code=400, detail="Invalid segment duration")

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
                events.put(json.dumps({"type": "metadata", "language": info.language, "duration": duration}))

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

        traceback_text = traceback.format_exc()
        print(f"[transcribe-segment] exception: {exc}\n{traceback_text}")
        raise HTTPException(status_code=500, detail=f"Segment transcription failed: {exc}")
