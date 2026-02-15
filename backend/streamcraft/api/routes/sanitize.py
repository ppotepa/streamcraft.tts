"""Sanitize/review/export endpoints (migration slice 1)."""

import asyncio
import datetime
import json
import queue
from pathlib import Path

import soundfile as sf
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from streamcraft.api.common.artifacts import merge_run_stage_artifacts
from streamcraft.api.common.paths import to_workspace_relative
from streamcraft.api.common.request_validation import require_run_id_or_400
from streamcraft.api.common.review_files import load_manifest_payload, load_review_payload
from streamcraft.api.common.run_scope import segment_review_path
from streamcraft.api.common.sanitize_state import (
	clear_sanitize_cancel_event,
	get_sanitize_cancel_event,
	timestamp_logs,
)
from streamcraft.api.common.threading_utils import run_blocking
from streamcraft.models.api import (
	ExportClipItem,
	ExportClipsRequest,
	ExportClipsResponse,
	GetSegmentReviewResponse,
	RunSanitizeRequest,
	RunSanitizeResponse,
	SaveSegmentReviewRequest,
	SaveSegmentReviewResponse,
	SegmentManifestItem,
	SegmentManifestResponse,
	SegmentReviewVote,
)

router = APIRouter()


@router.post("/sanitize/run")
async def run_sanitize(request: RunSanitizeRequest) -> RunSanitizeResponse:
	"""Sanitize audio by trimming silence and normalizing speech segments."""
	try:
		from streamcraft.core.pipeline import configure_temp_dir, resolve_output_dirs
		from streamcraft.core.sanitize_v2 import SanitiseConfig, SanitiseMode, SanitisePreset, run_sanitise_v2

		configure_temp_dir(Path.cwd())

		run_id = require_run_id_or_400(request.runId, "/sanitize/run")
		out_root = Path(request.outdir or "out")
		dataset_root = Path(request.datasetOut or "dataset")
		_, _, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

		mode = SanitiseMode(request.mode) if request.mode in {"auto", "voice"} else (
			SanitiseMode.VOICE if request.voiceSample else SanitiseMode.AUTO
		)
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
			timestamped_log = timestamp_logs(result.log)

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
			cancel_event = get_sanitize_cancel_event(request.jobId)
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
					merge_run_stage_artifacts(
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
					q.put({"type": "done", "result": payload.dict()})
				except FileNotFoundError as exc:
					q.put({"type": "error", "error": str(exc), "status": 404})
				except Exception as exc:
					exc_text = str(exc)
					error_msg = "Sanitize canceled by user" if "canceled by user" in exc_text.lower() else f"Sanitize failed: {exc}"
					q.put({"type": "error", "error": error_msg, "status": 500})
				finally:
					if request.jobId:
						clear_sanitize_cancel_event(request.jobId)

			threading.Thread(target=worker, daemon=True).start()

			def iterator():
				while True:
					evt = q.get()
					yield json.dumps(evt) + "\n"
					if evt.get("type") in {"done", "error"}:
						break

			return StreamingResponse(iterator(), media_type="application/x-ndjson")

		result = await run_blocking(
			run_sanitise_v2,
			request.vodUrl,
			out_root,
			dataset_root,
			cfg,
			should_cancel=cancel_event.is_set if cancel_event else None,
			run_id=run_id,
		)

		merge_run_stage_artifacts(
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
			clear_sanitize_cancel_event(request.jobId)
		return payload
	except FileNotFoundError as exc:
		if request.jobId:
			clear_sanitize_cancel_event(request.jobId)
		raise HTTPException(status_code=404, detail=str(exc))
	except Exception as exc:
		if request.jobId:
			clear_sanitize_cancel_event(request.jobId)
		raise HTTPException(status_code=500, detail=f"Sanitize failed: {exc}")


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str) -> dict:
	event = get_sanitize_cancel_event(job_id)
	event.set()
	return {"status": "cancel-requested"}


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

	run_id = require_run_id_or_400(runId, "/sanitize/segments")

	out_root = Path(outdir or "out")
	dataset_root = Path(datasetOut or "dataset")
	_, vod_dir, dataset_dir = resolve_output_dirs(vodUrl, out_root, dataset_root, run_id=run_id)

	manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
	try:
		payload = load_manifest_payload(manifest_path)
	except FileNotFoundError as exc:
		raise HTTPException(status_code=404, detail=str(exc))

	srt_path = dataset_dir / "asr" / f"{vod_dir.name}.srt"
	srt_cues = []
	if srt_path.exists():
		try:
			srt_cues = parse_srt(srt_path)
		except Exception:
			pass

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

		seg_start = float(seg.get("start", 0.0))
		seg_end = float(seg.get("end", 0.0))
		text = None
		if srt_cues:
			overlapping = [cue for cue in srt_cues if not (cue.end <= seg_start or cue.start >= seg_end)]
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


@router.get("/sanitize/review")
async def get_segment_review(
	vodUrl: str = Query(..., description="VOD URL the review belongs to"),
	outdir: str = Query("out"),
	datasetOut: str = Query("dataset"),
	runId: str = Query(..., description="Run identifier"),
) -> GetSegmentReviewResponse:
	out_root = Path(outdir or "out")
	dataset_root = Path(datasetOut or "dataset")
	run_id = require_run_id_or_400(runId, "/sanitize/review")
	review_path = segment_review_path(vodUrl, out_root, dataset_root, run_id=run_id)
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
	run_id = require_run_id_or_400(request.runId, "/sanitize/review")

	out_root = Path(request.outdir or "out")
	dataset_root = Path(request.datasetOut or "dataset")
	review_path = segment_review_path(request.vodUrl, out_root, dataset_root, run_id=run_id)
	review_path.parent.mkdir(parents=True, exist_ok=True)

	accepted = sum(1 for vote in request.votes if vote.decision == "accept")
	rejected = sum(1 for vote in request.votes if vote.decision == "reject")
	updated_at = datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")

	payload = {
		"vodUrl": request.vodUrl,
		"totalSegments": request.totalSegments,
		"reviewIndex": request.reviewIndex,
		"accepted": accepted,
		"rejected": rejected,
		"updatedAt": updated_at,
		"votes": [vote.dict() for vote in request.votes],
	}

	await asyncio.to_thread(review_path.write_text, json.dumps(payload, indent=2), encoding="utf-8")

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

	run_id = require_run_id_or_400(request.runId, "/sanitize/export-clips")

	out_root = Path(request.outdir or "out")
	dataset_root = Path(request.datasetOut or "dataset")
	_, vod_dir, dataset_dir = resolve_output_dirs(request.vodUrl, out_root, dataset_root, run_id=run_id)

	def execute_export() -> ExportClipsResponse:
		review_path = segment_review_path(request.vodUrl, out_root, dataset_root, run_id=run_id)
		review_payload = load_review_payload(review_path)
		votes = review_payload.get("votes", [])
		accepted_indices = [entry.get("index") for entry in votes if entry.get("decision") == "accept"]

		if not accepted_indices:
			return ExportClipsResponse(clipsDir="", sampleRate=0, count=0, items=[])

		manifest_path = dataset_dir / f"{vod_dir.name}_segments.json"
		manifest_payload = load_manifest_payload(manifest_path)
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

	return await run_blocking(execute_export)
