from fastapi.testclient import TestClient

from streamcraft.api.main import app


client = TestClient(app)


def test_sanitize_review_requires_run_id_query() -> None:
    response = client.get(
        "/api/sanitize/review",
        params={"vodUrl": "https://www.twitch.tv/videos/123456789"},
    )
    assert response.status_code == 422


def test_sanitize_segments_requires_run_id_query() -> None:
    response = client.get(
        "/api/sanitize/segments",
        params={"vodUrl": "https://www.twitch.tv/videos/123456789"},
    )
    assert response.status_code == 422


def test_dataset_build_requires_run_id_body() -> None:
    response = client.post(
        "/api/dataset/build",
        json={"vodUrl": "https://www.twitch.tv/videos/123456789", "stream": False},
    )
    assert response.status_code == 400
    assert "runId is required" in response.json().get("detail", "")
