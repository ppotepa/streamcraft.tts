from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Streamcraft API", version="0.1.0")


class VodRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/vod/check")
def vod_check(req: VodRequest):
    # Placeholder until wired to twitch-dl
    return {
        "streamer": "placeholder",
        "title": "demo",
        "duration": "0",
        "previewUrl": "https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.png",
        "vodId": "0000",
    }
