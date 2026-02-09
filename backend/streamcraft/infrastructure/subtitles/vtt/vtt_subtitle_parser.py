"""VTT subtitle parser adapter."""

import re
from pathlib import Path

from streamcraft.domain.common.result import Err, Ok, Result
from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.ports.subtitle_parser import SubtitleParser


class VttSubtitleParser(SubtitleParser):
    """Parser for WebVTT subtitle files."""

    def parse(
        self,
        subtitle_path: Path,
        format: str = "vtt",
    ) -> Result[list[Cue], Exception]:
        """Parse WebVTT subtitle file.

        VTT format:
        WEBVTT

        00:00:01.500 --> 00:00:04.000
        This is the first subtitle

        00:00:05.000 --> 00:00:08.500
        This is the second subtitle

        Args:
            subtitle_path: Path to VTT file
            format: Must be "vtt" or "auto"

        Returns:
            Result containing list of Cue entities or error.
        """
        if format not in ("vtt", "auto"):
            return Err(Exception(f"VttSubtitleParser only supports 'vtt' format, got '{format}'"))

        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Remove WEBVTT header
            content = re.sub(r"^WEBVTT.*?\n\s*\n", "", content, flags=re.MULTILINE)

            cues: list[Cue] = []
            
            # Split by double newlines to get individual cue blocks
            blocks = re.split(r"\n\s*\n", content.strip())
            
            for block in blocks:
                lines = block.strip().split("\n")
                if len(lines) < 2:
                    continue
                
                # Find timing line (could be first or second line if identifier present)
                timing_line = None
                text_start = 0
                
                for i, line in enumerate(lines):
                    if "-->" in line:
                        timing_line = line
                        text_start = i + 1
                        break
                
                if not timing_line:
                    continue
                
                # Parse timing (format: 00:00:01.500 --> 00:00:04.000)
                timing_match = re.match(
                    r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})",
                    timing_line,
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
                text = "\n".join(lines[text_start:]).strip()
                # Remove VTT formatting tags
                text = re.sub(r"<[^>]+>", "", text)
                
                # Create Cue entity
                cue = Cue(
                    start_time=start_seconds,
                    end_time=end_seconds,
                    text=text,
                    confidence=None,
                )
                
                cues.append(cue)

            return Ok(cues)

        except FileNotFoundError:
            return Err(Exception(f"VTT file not found: {subtitle_path}"))
        except Exception as e:
            return Err(Exception(f"Failed to parse VTT file: {str(e)}"))
