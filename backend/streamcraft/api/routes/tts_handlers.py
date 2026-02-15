"""TTS route handlers."""

import asyncio
import datetime
import json
import os
import queue
import shutil
import subprocess
import threading
from pathlib import Path

import soundfile as sf
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import WORKSPACE_ROOT, to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.jobs.datasets_index import refresh_datasets_index
from streamcraft.models.api import RunTtsRequest, RunTtsResponse
from streamcraft.settings import get_settings


async def run_tts(request: RunTtsRequest):
    """Generate TTS output using XTTS v2. Supports streaming logs when stream=True."""
    try:
        from streamcraft.core.pipeline import resolve_output_dirs
        from streamcraft.core.reference_selector import select_reference_clips

        settings = get_settings()
        provider = (settings.tts_provider or "script").strip().lower()
        if provider != "script":
            raise HTTPException(
                status_code=501,
                detail=f"TTS provider '{provider}' is not implemented yet. Supported: script.",
            )

        run_id = require_run_id_or_400(request.runId, "/tts/run")
        out_root = Path(request.outdir or "out")
        dataset_root = Path(request.datasetOut or "dataset")
        _, _, _ = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

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
                run_clip_dirs = sorted([path / "clips" for path in runs_root.iterdir() if path.is_dir()], reverse=True)
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
        requested_speaker_clips = (
            int(max(1, min(128, request.speakerClipCount))) if request.speakerClipCount is not None else None
        )

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

        if not selected_clip_paths or (
            requested_speaker_clips is not None and len(selected_clip_paths) < requested_speaker_clips
        ):
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

        temp_dataset_root = (
            WORKSPACE_ROOT
            / "temp"
            / "tts"
            / streamer_slug
            / datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S_%f")
        ).resolve()
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

        tts_dir = (out_root / request.streamer / "tts").resolve()
        tts_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S")
        output_path = (tts_dir / f"tts_{request.streamer}_{timestamp}.wav").resolve()

        ps_script = (
            Path(settings.tts_script_path).resolve()
            if settings.tts_script_path
            else (WORKSPACE_ROOT / "scripts" / "tts-generate.ps1")
        )
        if not ps_script.exists():
            raise HTTPException(
                status_code=500,
                detail=(
                    f"TTS generation script not found: {ps_script}. "
                    "Step 7 requires an external XTTS generation script. "
                    "Current pipeline prepares dataset clips in Step 6 but does not train a model checkpoint by itself."
                ),
            )

        command = [
            "pwsh",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps_script),
            "-Text",
            request.text,
            "-SpeakerDataset",
            str(streamer_dataset),
            "-SpeakerClipCount",
            str(len(prepared_paths)),
            "-OutputFile",
            str(output_path),
            "-Model",
            (request.model or "xtts_v2"),
            "-Language",
            (request.language or "en"),
            "-Device",
            (request.device or "auto"),
        ]

        if request.cpuThreads is not None:
            command.extend(["-CpuThreads", str(int(max(1, min(64, request.cpuThreads))))])
        if request.cudaBenchmark is not None:
            command.extend(["-CudaBenchmark", str(bool(request.cudaBenchmark))])
        if request.temperature is not None:
            command.extend(["-Temperature", str(float(max(0.0, min(2.0, request.temperature))))])
        if request.topP is not None:
            command.extend(["-TopP", str(float(max(0.0, min(1.0, request.topP))))])
        if request.topK is not None:
            command.extend(["-TopK", str(int(max(0, min(200, request.topK))))])
        if request.speed is not None:
            command.extend(["-Speed", str(float(max(0.5, min(2.0, request.speed))))])
        if request.repetitionPenalty is not None:
            command.extend(["-RepetitionPenalty", str(float(max(0.5, min(3.0, request.repetitionPenalty))))])
        if request.lengthPenalty is not None:
            command.extend(["-LengthPenalty", str(float(max(0.2, min(3.0, request.lengthPenalty))))])

        if not request.stream:
            log_buffer: list[str] = []

            def add_log(message: str) -> None:
                timestamp_value = datetime.datetime.now(datetime.UTC).strftime("%H:%M:%S")
                entry = f"[{timestamp_value}] {message}"
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
                    f"minClipSec={request.minClipSec or 0} maxClipSec={request.maxClipSec or 'none'} maxClips={request.maxClips or 'none'} "
                    f"temperature={request.temperature if request.temperature is not None else 'auto'} "
                    f"topP={request.topP if request.topP is not None else 'auto'} "
                    f"topK={request.topK if request.topK is not None else 'auto'} "
                    f"speed={request.speed if request.speed is not None else 'auto'} "
                    f"repetitionPenalty={request.repetitionPenalty if request.repetitionPenalty is not None else 'auto'} "
                    f"lengthPenalty={request.lengthPenalty if request.lengthPenalty is not None else 'auto'}"
                )
            add_log(f"Text: {request.text}")
            add_log(f"Output: {output_path}")
            add_log(f"Running: {' '.join(command)}")

            result = await asyncio.to_thread(
                subprocess.run,
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=600,
            )

            if result.stdout:
                for line in result.stdout.split("\n"):
                    if line.strip():
                        add_log(line.strip())
            if result.stderr:
                for line in result.stderr.split("\n"):
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
                    lines = [line for line in result.stderr.split("\n") if line.strip()]
                    err_tail = lines[-1] if lines else None
                shutil.rmtree(streamer_dataset, ignore_errors=True)
                raise HTTPException(status_code=500, detail=err_tail or "TTS output file not created")

            add_log(f"TTS generated successfully: {output_path}")

            merge_run_stage_artifacts(
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

            return RunTtsResponse(outputPath=to_workspace_relative(output_path), exitCode=result.returncode, log=log_buffer)

        async def stream_logs():
            start = datetime.datetime.now(datetime.UTC).strftime("%H:%M:%S")
            yield json.dumps({"type": "log", "line": f"[{start}] Starting TTS generation..."}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Streamer dataset: {streamer_dataset}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Clips dir: {clips_dir}"}) + "\n"
            yield json.dumps(
                {
                    "type": "log",
                    "line": (
                        f"[{start}] TTS options: sourceMode={request.sourceMode} quality={quality_mode} "
                        f"acceptedOnly={request.acceptedOnly} advancedMode={request.advancedMode} "
                        f"selectedClips={len(prepared_paths)} targetSeconds={profile['target_seconds']}"
                    ),
                }
            ) + "\n"
            yield json.dumps(
                {
                    "type": "log",
                    "line": (
                        f"[{start}] TTS selection: requestedSpeakerClipCount={requested_speaker_clips or 'auto'} "
                        f"effectiveSpeakerClipCount={len(prepared_paths)}"
                    ),
                }
            ) + "\n"
            if request.advancedMode:
                yield json.dumps(
                    {
                        "type": "log",
                        "line": (
                            f"[{start}] TTS advanced: model={(request.model or 'xtts_v2')} lang={(request.language or 'en')} "
                            f"device={(request.device or 'auto')} cpuThreads={request.cpuThreads or 'auto'} "
                            f"minClipSec={request.minClipSec or 0} maxClipSec={request.maxClipSec or 'none'} maxClips={request.maxClips or 'none'} "
                            f"temperature={request.temperature if request.temperature is not None else 'auto'} "
                            f"topP={request.topP if request.topP is not None else 'auto'} "
                            f"topK={request.topK if request.topK is not None else 'auto'} "
                            f"speed={request.speed if request.speed is not None else 'auto'} "
                            f"repetitionPenalty={request.repetitionPenalty if request.repetitionPenalty is not None else 'auto'} "
                            f"lengthPenalty={request.lengthPenalty if request.lengthPenalty is not None else 'auto'}"
                        ),
                    }
                ) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Text: {request.text}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Output: {output_path}"}) + "\n"
            yield json.dumps({"type": "log", "line": f"[{start}] Running: {' '.join(command)}"}) + "\n"

            events: queue.Queue[object] = queue.Queue()
            sentinel = object()

            def worker() -> None:
                try:
                    process = subprocess.Popen(
                        command,
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
                        events.put(json.dumps({"type": "error", "exitCode": code, "error": f"TTS generation failed (code={code})"}))
                        return

                    if not output_path.exists():
                        events.put(json.dumps({"type": "error", "exitCode": code, "error": f"TTS output missing (code={code})"}))
                        return

                    events.put(json.dumps({"type": "done", "exitCode": code, "outputPath": to_workspace_relative(output_path)}))
                    merge_run_stage_artifacts(
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
