"""Audio domain."""

from streamcraft.domain.audio.entities import AudioFile, AudioSegment
from streamcraft.domain.audio.errors import (
    ExtractionFailedError,
    InvalidAudioFormatError,
    SegmentInvalidError,
)
from streamcraft.domain.audio.ports import AudioExtractor, AudioQualityAnalyzer, AudioSlicer
from streamcraft.domain.audio.value_objects import AudioFormat, RmsDb, SampleRate, TimeRange

__all__ = [
    "AudioFile",
    "AudioSegment",
    "ExtractionFailedError",
    "InvalidAudioFormatError",
    "SegmentInvalidError",
    "AudioExtractor",
    "AudioQualityAnalyzer",
    "AudioSlicer",
    "AudioFormat",
    "RmsDb",
    "SampleRate",
    "TimeRange",
]
