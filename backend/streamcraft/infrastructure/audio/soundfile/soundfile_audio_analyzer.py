"""Soundfile audio quality analyzer implementation."""

from pathlib import Path

from streamcraft.domain.audio.ports.audio_quality_analyzer import AudioQualityAnalyzer
from streamcraft.domain.audio.value_objects.rms_db import RmsDb
from streamcraft.domain.shared.result import Failure, Result, Success


class SoundfileAudioAnalyzer(AudioQualityAnalyzer):
    """Soundfile implementation of audio quality analyzer."""

    def analyze_rms(self, audio_path: Path) -> Result[RmsDb, Exception]:
        """Analyze RMS level of audio file using soundfile."""
        try:
            import numpy as np
            import soundfile as sf

            # Read audio file
            audio_data, sample_rate = sf.read(str(audio_path))

            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            # Calculate RMS
            rms_linear = np.sqrt(np.mean(audio_data**2))

            # Convert to dB
            rms_db = RmsDb.from_linear(float(rms_linear))

            return Success(value=rms_db)

        except ImportError:
            return Failure(error=Exception("soundfile or numpy not installed"))
        except Exception as e:
            return Failure(error=Exception(f"Failed to analyze RMS: {e}"))

    def calculate_quality_score(self, audio_path: Path) -> Result[float, Exception]:
        """Calculate overall quality score (0.0 to 1.0)."""
        try:
            import numpy as np
            import soundfile as sf

            # Read audio file
            audio_data, sample_rate = sf.read(str(audio_path))

            # Convert to mono if stereo
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            # Calculate multiple quality metrics
            rms = np.sqrt(np.mean(audio_data**2))
            peak = np.max(np.abs(audio_data))
            dynamic_range = np.max(audio_data) - np.min(audio_data)

            # Quality scoring based on:
            # 1. RMS level (too quiet or too loud is bad)
            # 2. Peak level (clipping is bad)
            # 3. Dynamic range (very flat is bad)

            # RMS score (optimal around 0.1-0.3)
            rms_score = 1.0 - abs(rms - 0.2) / 0.3
            rms_score = max(0.0, min(1.0, rms_score))

            # Peak score (no clipping)
            peak_score = 1.0 if peak < 0.95 else 0.5

            # Dynamic range score
            dr_score = min(dynamic_range / 0.5, 1.0)

            # Weighted average
            quality_score = (rms_score * 0.5) + (peak_score * 0.3) + (dr_score * 0.2)

            return Success(value=float(quality_score))

        except ImportError:
            return Failure(error=Exception("soundfile or numpy not installed"))
        except Exception as e:
            return Failure(error=Exception(f"Failed to calculate quality score: {e}"))
