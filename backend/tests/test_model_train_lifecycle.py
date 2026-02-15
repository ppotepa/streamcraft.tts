import os
import time
from pathlib import Path

from fastapi.testclient import TestClient

from streamcraft.api.main import app
from streamcraft.core.pipeline import resolve_output_dirs
import streamcraft.settings as settings_module


client = TestClient(app)


def test_model_train_job_lifecycle(tmp_path: Path) -> None:
    train_script = tmp_path / "train_dummy.py"
    train_script.write_text(
        """
import argparse
import json
import pathlib
import time

parser = argparse.ArgumentParser()
parser.add_argument('--dataset-manifest')
parser.add_argument('--checkpoint-dir')
parser.add_argument('--base-model')
parser.add_argument('--epochs')
args = parser.parse_args()

ckpt = pathlib.Path(args.checkpoint_dir)
(ckpt / 'weights').mkdir(parents=True, exist_ok=True)
for pct in (10, 35, 70, 100):
    print(f'{pct}% training')
    time.sleep(0.05)

(ckpt / 'weights' / 'model.bin').write_bytes(b'weights')
(ckpt / 'config.json').write_text(json.dumps({'baseModel': args.base_model}), encoding='utf-8')
(ckpt / 'metrics.json').write_text(json.dumps({'loss': 0.1}), encoding='utf-8')
""".strip(),
        encoding="utf-8",
    )

    os.environ["STREAMCRAFT_MODEL_TRAIN_SCRIPT_PATH"] = str(train_script)
    settings_module._settings = None

    out_root = tmp_path / "out"
    dataset_root = tmp_path / "dataset"
    model_root = tmp_path / "models"
    vod_url = "https://www.twitch.tv/videos/123456789"
    run_id = "run_test_1"

    _, _, dataset_dir = resolve_output_dirs(vod_url, out_root, dataset_root, run_id=run_id)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    manifest = dataset_dir / "manifest.jsonl"
    manifest.write_text('{"clip":"000001.wav","text":"hello","duration":1.0}\n', encoding='utf-8')

    response = client.post(
        "/api/model/train",
        json={
            "vodUrl": vod_url,
            "runId": run_id,
            "outdir": str(out_root),
            "datasetOut": str(dataset_root),
            "modelOut": str(model_root),
            "baseModel": "xtts_v2",
            "epochs": 1,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    job_id = payload["jobId"]

    deadline = time.time() + 20
    status_payload = None
    while time.time() < deadline:
        status_response = client.get(f"/api/model/train/jobs/{job_id}")
        assert status_response.status_code == 200
        status_payload = status_response.json()
        if status_payload["status"] in {"done", "failed", "canceled"}:
            break
        time.sleep(0.1)

    assert status_payload is not None
    assert status_payload["status"] == "done"
    checkpoint_path = Path(status_payload["checkpointPath"])
    if not checkpoint_path.is_absolute():
        checkpoint_path = (Path.cwd() / checkpoint_path).resolve()

    assert (checkpoint_path / "weights").exists()
    assert (checkpoint_path / "config.json").exists()
    assert (checkpoint_path / "metrics.json").exists()
    assert (checkpoint_path / "training_manifest.jsonl").exists()
