"""VOD route handlers."""

import asyncio
import re

from fastapi import HTTPException

from streamcraft.models.api import VodMetaResponse


async def check_vod(vod_url: str) -> VodMetaResponse:
    """Check VOD and return metadata from Twitch or YouTube."""
    try:
        platform = "youtube" if "youtube.com" in vod_url or "youtu.be" in vod_url else "twitch"

        if platform == "youtube":
            yt_pattern = r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)"
            match = re.search(yt_pattern, vod_url)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid YouTube URL")
            video_id = match.group(1)

            return VodMetaResponse(
                streamer="YouTube Channel",
                vodId=video_id,
                title="YouTube Video (metadata fetch not yet implemented)",
                duration="0:00",
                previewUrl=f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                platform="youtube",
            )

        if not vod_url.startswith("http"):
            raise HTTPException(status_code=400, detail="Only Twitch/YouTube URLs supported for metadata fetch")

        from twitchdl import twitch, utils  # type: ignore

        vid = utils.parse_video_identifier(vod_url)
        if not vid:
            raise HTTPException(status_code=400, detail="Invalid Twitch VOD URL")

        video = await asyncio.to_thread(twitch.get_video, vid)
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
            platform="twitch",
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="twitchdl not installed")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch VOD metadata: {str(exc)}")
