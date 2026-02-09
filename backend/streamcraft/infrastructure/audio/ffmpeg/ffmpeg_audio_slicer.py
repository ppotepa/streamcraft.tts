"""FFmpeg audio slicer adapter."""

import subprocess
from pathlib import Path

from streamcraft.domain.audio.entities.audio_segment import AudioSegment
from streamcraft.domain.audio.ports.audio_slicer import AudioSlicer
from streamcraft.domain.audio.value_objects.time_range import TimeRange
from streamcraft.domain.common.result import Err, Ok, Result


class FFmpegAudioSlicer(AudioSlicer):
    """Audio slicer implementation using FFmpeg."""

    def slice(
        self, audio_path: Path, time_range: TimeRange, output_path: Path
    ) -> Result[AudioSegment, Exception]:
        """Slice audio file using FFmpeg.

        Uses FFmpeg's -ss (start) and -t (duration) options for precise audio slicing.

        Args:
            audio_path: Path to input audio file
            time_range: Time range to extract (start and end times)
            output_path: Path where sliced audio should be saved

        Returns:
            Result containing AudioSegment entity or error.
        """
        try:
            # Calculate duration
            duration = time_range.end_seconds - time_range.start_seconds

            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Build FFmpeg command
            # -ss: start time, -t: duration, -c copy: copy codec (fast)
            command = [
                "ffmpeg",
                "-i", str(audio_path),
                "-ss", str(time_range.start_seconds),
                "-t", str(duration),
                "-c", "copy",  # Copy codec for speed
                "-y",  # Overwrite output file
                str(output_path),
            ]

            # Execute FFmpeg
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=300,  # 5 minute timeout
            )

            # Verify output file was created
            if not output_path.exists():
                return Err(
                    Exception(f"FFmpeg completed but output file not found: {output_path}")
                )

            # Create AudioSegment entity
            segment = AudioSegment(
                file_path=output_path,
                time_range=time_range,
            )

            return Ok(segment)

        except subprocess.TimeoutExpired:
            return Err(Exception(f"FFmpeg timed out while slicing {audio_path}"))
        except subprocess.CalledProcessError as e:
            return Err(
                Exception(f"FFmpeg failed: {e.stderr}")
            )
        except FileNotFoundError:
            return Err(
                Exception("ffmpeg not found. Please install FFmpeg.")
            )
        except Exception as e:
            return Err(
                Exception(f"Unexpected error during audio slicing: {str(e)}")
            )
