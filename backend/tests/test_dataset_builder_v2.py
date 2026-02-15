from pathlib import Path

import numpy as np
import soundfile as sf

from streamcraft.core.dataset_builder_v2 import build_dataset_from_run


def _write_srt(path: Path) -> None:
    path.write_text(
        """1
00:00:00,000 --> 00:00:01,000
hello there

2
00:00:01,000 --> 00:00:02,000
general kenobi
""",
        encoding="utf-8",
    )


def test_dataset_builder_writes_jsonl_and_is_immutable_without_force(tmp_path: Path) -> None:
    run_dir = tmp_path / "dataset" / "streamer" / "runs" / "run_1"
    run_dir.mkdir(parents=True)

    clean_audio = tmp_path / "clean.wav"
    audio = (np.sin(np.linspace(0, 40, 32000)) * 0.1).astype(np.float32)
    sf.write(str(clean_audio), audio, 16000)

    sanitize_manifest = run_dir / "vod_segments.json"
    sanitize_manifest.write_text(
        """
{
  "segments": [
    {"start": 0.0, "end": 1.0, "dur": 1.0, "kept": true, "quality": 90, "speech_ratio": 0.8, "snr_db": 12, "clip_ratio": 0.01, "sfx_score": 0.02, "speaker_sim": 0.95},
    {"start": 1.0, "end": 2.0, "dur": 1.0, "kept": true, "quality": 85, "speech_ratio": 0.75, "snr_db": 10, "clip_ratio": 0.01, "sfx_score": 0.03, "speaker_sim": 0.93}
  ]
}
""".strip(),
        encoding="utf-8",
    )

    review = run_dir / "vod_segment_review.json"
    review.write_text(
        """
{
  "votes": [
    {"index": 0, "decision": "accept"},
    {"index": 1, "decision": "accept"}
  ]
}
""".strip(),
        encoding="utf-8",
    )

    srt = run_dir / "vod.srt"
    _write_srt(srt)

    result = build_dataset_from_run(
        run_dir=run_dir,
        vod_slug="vod",
        clean_audio_path=clean_audio,
        sanitize_manifest_path=sanitize_manifest,
        review_path=review,
        asr_srt_path=srt,
        force=False,
    )

    assert result.manifest_jsonl.exists()
    lines = [line for line in result.manifest_jsonl.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) >= 2

    try:
        build_dataset_from_run(
            run_dir=run_dir,
            vod_slug="vod",
            clean_audio_path=clean_audio,
            sanitize_manifest_path=sanitize_manifest,
            review_path=review,
            asr_srt_path=srt,
            force=False,
        )
    except RuntimeError as exc:
        assert "already built" in str(exc)
    else:
        raise AssertionError("Expected immutability guard to block rebuild without force")
