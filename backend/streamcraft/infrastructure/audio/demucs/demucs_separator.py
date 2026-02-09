"""
Demucs Audio Separator Adapter
"""

from pathlib import Path
from typing import List, Optional

from ....domain.audio.entities import AudioFile
from ....domain.audio.ports import AudioSeparator
from ....domain.shared.result import Result, Err, Ok


class DemucsSeparator(AudioSeparator):
    """Demucs-based audio source separation."""

    def __init__(self, model_name: str = "htdemucs", device: str = "cpu") -> None:
        """
        Initialize Demucs separator.

        Args:
            model_name: Demucs model to use (htdemucs, htdemucs_ft, etc.)
            device: Device for inference (cpu, cuda, mps)
        """
        self._model_name = model_name
        self._device = device

    async def separate(
        self, audio_path: str, output_dir: str, stems: Optional[List[str]] = None
    ) -> Result[dict[str, AudioFile], Exception]:
        """
        Separate audio into stems (vocals, drums, bass, other).

        Args:
            audio_path: Path to input audio file
            output_dir: Directory to save separated stems
            stems: List of stems to extract (default: all)

        Returns:
            Result containing dict mapping stem names to AudioFile entities
        """
        try:
            # Validate inputs
            if not Path(audio_path).exists():
                return Err(FileNotFoundError(f"Audio file not found: {audio_path}"))

            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            # Default stems
            if stems is None:
                stems = ["vocals", "drums", "bass", "other"]

            # Note: Real implementation would use demucs library
            # from demucs.pretrained import get_model
            # from demucs.apply import apply_model
            #
            # model = get_model(self._model_name)
            # model.to(self._device)
            # wav = load_audio(audio_path)
            # sources = apply_model(model, wav)
            # save_stems(sources, output_dir)

            # For now, return not implemented
            return Err(
                NotImplementedError(
                    "Demucs integration requires demucs library installation. "
                    "Install with: pip install demucs"
                )
            )

        except Exception as e:
            return Err(e)

    def _create_audio_file(self, path: str) -> AudioFile:
        """Create AudioFile entity from path."""
        file_path = Path(path)
        # Placeholder - would need to read actual audio properties
        return AudioFile(
            path=str(file_path),
            format=file_path.suffix.lstrip("."),
            sample_rate=44100,  # Placeholder
            duration_seconds=0.0,  # Would need to read from file
            file_size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        )
