"""
Whisper-based transcriber implementation using faster-whisper.
Provides high-quality audio transcription with word-level timestamps.
"""

from pathlib import Path
from typing import Optional

from streamcraft.domain.transcription.entities.cue import Cue
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.ports.transcriber import Transcriber
from streamcraft.domain.shared.result import Result, Success, Failure


class WhisperTranscriber(Transcriber):
    """Transcriber implementation using faster-whisper."""

    def __init__(self, model_size: str = "base", device: str = "auto") -> None:
        """
        Initialize Whisper transcriber.

        Args:
            model_size: Model size (tiny, base, small, medium, large-v3)
            device: Device to use (cpu, cuda, auto)
        """
        self._model_size = model_size
        self._device = device
        self._model: Optional[any] = None

    async def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
    ) -> Result[Transcript, Exception]:
        """
        Transcribe audio file using Whisper.

        Args:
            audio_path: Path to audio file
            language: Optional language code (e.g., 'en', 'es')

        Returns:
            Result containing Transcript with cues or error
        """
        try:
            # Lazy load model
            if self._model is None:
                from faster_whisper import WhisperModel

                # Determine device
                device = self._device
                if device == "auto":
                    try:
                        import torch
                        device = "cuda" if torch.cuda.is_available() else "cpu"
                    except ImportError:
                        device = "cpu"

                # Use int8 for better performance on CPU
                compute_type = "int8" if device == "cpu" else "float16"

                self._model = WhisperModel(
                    self._model_size,
                    device=device,
                    compute_type=compute_type,
                )

            if not audio_path.exists():
                return Failure(FileNotFoundError(f"Audio file not found: {audio_path}"))

            # Transcribe with word-level timestamps
            segments, info = self._model.transcribe(
                str(audio_path),
                language=language,
                word_timestamps=True,
                vad_filter=True,  # Voice activity detection
                vad_parameters={
                    "threshold": 0.5,
                    "min_speech_duration_ms": 250,
                    "min_silence_duration_ms": 100,
                },
            )

            # Convert segments to cues
            cues: list[Cue] = []
            for segment in segments:
                # Use segment-level timestamps
                cue = Cue(
                    start_seconds=segment.start,
                    end_seconds=segment.end,
                    text=segment.text.strip(),
                    confidence=segment.avg_logprob if hasattr(segment, 'avg_logprob') else None,
                )
                cues.append(cue)

            # Create transcript
            from streamcraft.domain.shared.branded_types import create_transcription_id
            from datetime import datetime

            transcript = Transcript(
                transcription_id=create_transcription_id(audio_path.stem),
                audio_path=audio_path,
                model=f"whisper-{self._model_size}",
                language=info.language if hasattr(info, 'language') else language,
                cues=cues,
                created_at=datetime.now(),
            )

            return Success(transcript)

        except ImportError as e:
            return Failure(
                ImportError(
                    f"faster-whisper not installed. Install with: pip install faster-whisper. Error: {e}"
                )
            )
        except Exception as e:
            return Failure(e)

    def get_model_size(self) -> str:
        """Get the model size being used."""
        return self._model_size

    def get_device(self) -> str:
        """Get the device being used."""
        return self._device
