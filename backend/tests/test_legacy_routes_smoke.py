from fastapi.testclient import TestClient

from streamcraft.infrastructure.web.fastapi.app import create_app


client = TestClient(create_app())


def test_legacy_sanitize_review_route_exists() -> None:
    response = client.get(
        "/api/legacy/sanitize/review",
        params={
            "vodUrl": "https://www.twitch.tv/videos/123456789",
            "runId": "run_smoke_legacy",
        },
    )
    assert response.status_code != 404


def test_legacy_sanitize_segments_route_exists() -> None:
    response = client.get(
        "/api/legacy/sanitize/segments",
        params={
            "vodUrl": "https://www.twitch.tv/videos/123456789",
            "runId": "run_smoke_legacy",
        },
    )
    if response.status_code == 404:
        assert response.json().get("detail") != "Not Found"


def test_legacy_srt_routes_exist() -> None:
    run_response = client.post(
        "/api/legacy/srt/run",
        json={
            "vodUrl": "https://www.twitch.tv/videos/123456789",
            "runId": "run_smoke_legacy",
            "stream": False,
        },
    )
    assert run_response.status_code != 404

    segment_response = client.post(
        "/api/legacy/srt/transcribe-segment",
        json={
            "vodUrl": "https://www.twitch.tv/videos/123456789",
            "runId": "run_smoke_legacy",
            "segmentIndex": 0,
        },
    )
    assert segment_response.status_code in {200, 400, 404, 422, 500}


def test_legacy_tts_run_route_exists() -> None:
    response = client.post(
        "/api/legacy/tts/run",
        json={
            "vodUrl": "https://www.twitch.tv/videos/123456789",
            "runId": "run_smoke_legacy",
            "streamer": "unknown",
            "text": "hello",
            "stream": False,
        },
    )
    assert response.status_code != 404


def test_legacy_datasets_routes_exist() -> None:
    list_response = client.get("/api/legacy/datasets")
    assert list_response.status_code != 404

    streamers_response = client.get("/api/legacy/datasets/streamers")
    assert streamers_response.status_code != 404
