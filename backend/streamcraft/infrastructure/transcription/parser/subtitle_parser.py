"""
Subtitle parser for SRT and VTT formats.
Converts subtitle files to Transcript entities.
"""

import re
from pathlib import Path
from typing import Optional

from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.ports.subtitle_parser import SubtitleParser
from streamcraft.domain.shared.result import Result, Success, Failure


class SubtitleParserImpl(SubtitleParser):
    """Parser for SRT and VTT subtitle formats."""

    async def parse(
        self,
        subtitle_path: Path,
        format: Optional[str] = None,
    ) -> Result[Transcript, Exception]:
        """
        Parse subtitle file.

        Args:
            subtitle_path: Path to subtitle file
            format: Format hint ('srt', 'vtt', or 'auto' for auto-detection)

        Returns:
            Result containing Transcript or error
        """
        try:
            if not subtitle_path.exists():
                return Failure(FileNotFoundError(f"Subtitle file not found: {subtitle_path}"))

            # Auto-detect format from extension
            if format is None or format == "auto":
                ext = subtitle_path.suffix.lower()
                if ext == ".srt":
                    format = "srt"
                elif ext == ".vtt":
                    format = "vtt"
                else:
                    return Failure(ValueError(f"Unknown subtitle format: {ext}"))

            # Read file content
            content = subtitle_path.read_text(encoding="utf-8")

            # Parse based on format
            if format == "srt":
                cues = self._parse_srt(content)
            elif format == "vtt":
                cues = self._parse_vtt(content)
            else:
                return Failure(ValueError(f"Unsupported format: {format}"))

            # Create transcript
            from streamcraft.domain.shared.branded_types import create_transcription_id
            from datetime import datetime

            transcript = Transcript(
                transcription_id=create_transcription_id(subtitle_path.stem),
                audio_path=subtitle_path.parent / f"{subtitle_path.stem}.wav",  # Assume audio file
                model=f"subtitle-{format}",
                language=None,
                cues=cues,
                created_at=datetime.now(),
            )

            return Success(transcript)

        except Exception as e:
            return Failure(e)

    def _parse_srt(self, content: str) -> list[Cue]:
        """Parse SRT format."""
        cues: list[Cue] = []

        # SRT format:
        # 1
        # 00:00:00,000 --> 00:00:02,000
        # Text line 1
        # Text line 2
        #
        # 2
        # 00:00:02,000 --> 00:00:04,000
        # More text

        blocks = content.strip().split("\n\n")

        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 3:
                continue

            # Parse timing line (second line)
            timing_line = lines[1]
            match = re.match(
                r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})",
                timing_line,
            )

            if not match:
                continue

            # Extract times
            start_h, start_m, start_s, start_ms = map(int, match.groups()[:4])
            end_h, end_m, end_s, end_ms = map(int, match.groups()[4:])

            start_seconds = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
            end_seconds = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000

            # Join text lines (skip index and timing)
            text = " ".join(lines[2:]).strip()

            cue = Cue(
                start_seconds=start_seconds,
                end_seconds=end_seconds,
                text=text,
                confidence=None,
            )
            cues.append(cue)

        return cues

    def _parse_vtt(self, content: str) -> list[Cue]:
        """Parse VTT format."""
        cues: list[Cue] = []

        # VTT format:
        # WEBVTT
        #
        # 00:00:00.000 --> 00:00:02.000
        # Text line 1
        #
        # 00:00:02.000 --> 00:00:04.000
        # Text line 2

        # Skip header
        if content.startswith("WEBVTT"):
            content = content[6:].lstrip()

        blocks = content.strip().split("\n\n")

        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 2:
                continue

            # First line is timing
            timing_line = lines[0]
            match = re.match(
                r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})",
                timing_line,
            )

            if not match:
                continue

            # Extract times
            start_h, start_m, start_s, start_ms = map(int, match.groups()[:4])
            end_h, end_m, end_s, end_ms = map(int, match.groups()[4:])

            start_seconds = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
            end_seconds = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000

            # Join text lines (skip timing)
            text = " ".join(lines[1:]).strip()

            cue = Cue(
                start_seconds=start_seconds,
                end_seconds=end_seconds,
                text=text,
                confidence=None,
            )
            cues.append(cue)

        return cues
