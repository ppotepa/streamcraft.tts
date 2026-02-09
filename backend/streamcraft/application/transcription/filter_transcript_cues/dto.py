"""Filter transcript cues DTO."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FilterTranscriptCuesDto:
    """DTO for filter transcript cues response."""

    transcription_id: str
    original_cue_count: int
    filtered_cue_count: int
    removed_cue_count: int
    filters_applied: dict[str, str | float | bool]
