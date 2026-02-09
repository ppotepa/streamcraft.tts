"""SRT subtitle parser adapter."""

import re
from pathlib import Path

from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.ports.subtitle_parser import SubtitleParser


class SrtSubtitleParser(SubtitleParser):
    """Parser for SRT (SubRip Text) subtitle files."""

    def parse(
        self,
        subtitle_path: Path,
        format: str = "srt",
    ) -> Result[list[Cue], Exception]:
        """Parse SRT subtitle file.

        SRT format:
        1
        00:00:01,500 --> 00:00:04,000
        This is the first subtitle

        2
        00:00:05,000 --> 00:00:08,500
        This is the second subtitle

        Args:
            subtitle_path: Path to SRT file
            format: Must be "srt" or "auto"

        Returns:
            Result containing list of Cue entities or error.
        """
        if format not in ("srt", "auto"):
            return Err(Exception(f"SrtSubtitleParser only supports 'srt' format, got '{format}'"))

        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                content = f.read()

            cues: list[Cue] = []
            
            # Split by double newlines to get individual subtitle blocks
            blocks = re.split(r"\n\s*\n", content.strip())
            
            for block in blocks:
                lines = block.strip().split("\n")
                if len(lines) < 3:
                    continue
                
                # Parse timing line (line 2)
                timing_match = re.match(
                    r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})",
                    lines[1],
                )
                
                if not timing_match:
                    continue
                
                # Convert to seconds
                start_seconds = (
                    int(timing_match.group(1)) * 3600
                    + int(timing_match.group(2)) * 60
                    + int(timing_match.group(3))
                    + int(timing_match.group(4)) / 1000
                )
                
                end_seconds = (
                    int(timing_match.group(5)) * 3600
                    + int(timing_match.group(6)) * 60
                    + int(timing_match.group(7))
                    + int(timing_match.group(8)) / 1000
                )
                
                # Text is everything after timing line
                text = "\n".join(lines[2:]).strip()
                
                # Create Cue entity
                cue = Cue(
                    start_time=start_seconds,
                    end_time=end_seconds,
                    text=text,
                    confidence=None,  # SRT doesn't have confidence scores
                )
                
                cues.append(cue)

            return Ok(cues)

        except FileNotFoundError:
            return Err(Exception(f"SRT file not found: {subtitle_path}"))
        except Exception as e:
            return Err(Exception(f"Failed to parse SRT file: {str(e)}"))
