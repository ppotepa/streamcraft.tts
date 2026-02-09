"""
FFmpeg-based audio merger implementation.
Merges multiple audio files into a single file with optional normalization.
"""

from pathlib import Path
from typing import Optional

from streamcraft.domain.audio.entities.audio_file import AudioFile
from streamcraft.domain.audio.ports.audio_merger import AudioMerger
from streamcraft.domain.shared.result import Result, Success, Failure


class FFmpegAudioMerger(AudioMerger):
    """Merge audio files using FFmpeg."""

    def __init__(self) -> None:
        """Initialize FFmpeg audio merger."""
        pass

    async def merge(
        self,
        segment_paths: list[Path],
        output_path: Path,
        format: str = "wav",
        normalize: bool = False,
    ) -> Result[AudioFile, Exception]:
        """
        Merge multiple audio files into one.

        Args:
            segment_paths: List of paths to audio files to merge
            output_path: Path where merged audio will be saved
            format: Output format (wav, mp3, m4a)
            normalize: Whether to normalize audio levels

        Returns:
            Result containing merged AudioFile or error
        """
        try:
            import subprocess

            if not segment_paths:
                return Failure(ValueError("No segment paths provided"))

            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Create concat file list for FFmpeg
            concat_file = output_path.parent / "concat_list.txt"
            with open(concat_file, "w", encoding="utf-8") as f:
                for path in segment_paths:
                    if not path.exists():
                        return Failure(FileNotFoundError(f"Segment not found: {path}"))
                    # FFmpeg concat requires relative or absolute paths with proper escaping
                    f.write(f"file '{path.absolute()}'\n")

            # Build FFmpeg command
            cmd = [
                "ffmpeg",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(concat_file),
                "-y",  # Overwrite output file
            ]

            # Add normalization filter if requested
            if normalize:
                cmd.extend(["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"])

            # Set output format
            if format == "wav":
                cmd.extend(["-acodec", "pcm_s16le"])
            elif format == "mp3":
                cmd.extend(["-acodec", "libmp3lame", "-b:a", "192k"])
            elif format == "m4a":
                cmd.extend(["-acodec", "aac", "-b:a", "192k"])

            cmd.append(str(output_path))

            # Run FFmpeg
            result = subprocess.run(
                cmd, capture_output=True, text=True, check=False, timeout=300
            )

            # Clean up concat file
            concat_file.unlink(missing_ok=True)

            if result.returncode != 0:
                return Failure(
                    RuntimeError(f"FFmpeg merge failed: {result.stderr}")
                )

            # Get audio info using ffprobe
            probe_cmd = [
                "ffprobe",
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(output_path),
            ]

            probe_result = subprocess.run(
                probe_cmd, capture_output=True, text=True, check=False, timeout=30
            )

            if probe_result.returncode != 0:
                return Failure(
                    RuntimeError(f"FFprobe failed: {probe_result.stderr}")
                )

            import json

            probe_data = json.loads(probe_result.stdout)
            audio_stream = next(
                (s for s in probe_data.get("streams", []) if s.get("codec_type") == "audio"),
                {},
            )

            duration = float(probe_data.get("format", {}).get("duration", 0.0))
            sample_rate = int(audio_stream.get("sample_rate", 44100))

            # Create AudioFile entity
            from streamcraft.domain.shared.branded_types import create_audio_file_id

            audio_file = AudioFile(
                audio_file_id=create_audio_file_id(output_path.stem),
                path=output_path,
                duration_seconds=duration,
                sample_rate_hz=sample_rate,
                format=format,
            )

            return Success(audio_file)

        except subprocess.TimeoutExpired:
            return Failure(TimeoutError("FFmpeg merge timed out after 5 minutes"))
        except Exception as e:
            return Failure(e)
