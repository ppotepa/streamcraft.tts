"""FFmpeg audio extractor implementation."""

import subprocess
import uuid
from pathlib import Path

from streamcraft.domain.audio.entities.audio_file import AudioFile
from streamcraft.domain.audio.errors.audio_errors import ExtractionFailedError
from streamcraft.domain.audio.ports.audio_extractor import AudioExtractor
from streamcraft.domain.audio.value_objects.audio_format import AudioFormat
from streamcraft.domain.audio.value_objects.sample_rate import SampleRate
from streamcraft.domain.shared.branded_types import AudioFileId, create_audio_file_id
from streamcraft.domain.shared.result import Failure, Result, Success
from streamcraft.domain.shared.value_objects import Duration


class FFmpegAudioExtractor(AudioExtractor):
    """FFmpeg implementation of audio extractor."""

    def __init__(self, ffmpeg_path: str = "ffmpeg") -> None:
        """Initialize with FFmpeg executable path."""
        self._ffmpeg_path = ffmpeg_path

    def extract(
        self, video_path: Path, output_path: Path, audio_only: bool = True
    ) -> Result[AudioFile, ExtractionFailedError]:
        """Extract audio from video file using FFmpeg."""
        try:
            # Construct FFmpeg command
            cmd = [
                self._ffmpeg_path,
                "-i",
                str(video_path),
                "-vn",  # No video
                "-acodec",
                "pcm_s16le",  # PCM 16-bit
                "-ar",
                "16000",  # 16kHz sample rate
                "-ac",
                "1",  # Mono
                "-y",  # Overwrite output file
                str(output_path),
            ]

            # Run FFmpeg
            result = subprocess.run(cmd, capture_output=True, text=True, check=False)

            if result.returncode != 0:
                return Failure(
                    error=ExtractionFailedError(
                        source_path=str(video_path), reason=f"FFmpeg failed: {result.stderr}"
                    )
                )

            # Verify output file exists
            if not output_path.exists():
                return Failure(
                    error=ExtractionFailedError(
                        source_path=str(video_path), reason="Output file was not created"
                    )
                )

            # Get file size
            size_bytes = output_path.stat().st_size

            # Get duration using FFprobe
            duration_seconds = self._get_duration(output_path)

            # Create AudioFile entity
            audio_file = AudioFile(
                id=create_audio_file_id(str(uuid.uuid4())),
                path=output_path,
                format=AudioFormat.WAV,
                sample_rate=SampleRate.rate_16k(),
                duration=Duration(seconds=duration_seconds),
                size_bytes=size_bytes,
                channels=1,
            )

            return Success(value=audio_file)

        except Exception as e:
            return Failure(
                error=ExtractionFailedError(source_path=str(video_path), reason=str(e))
            )

    def _get_duration(self, audio_path: Path) -> float:
        """Get audio duration using FFprobe."""
        try:
            cmd = [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())
        except Exception:
            return 0.0
