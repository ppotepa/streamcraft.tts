"""Get transcript command."""

from dataclasses import dataclass

from streamcraft.domain.transcription import TranscriptId


@dataclass(frozen=True)
class GetTranscriptCommand:
    """Command to retrieve a transcription."""

    transcription_id: TranscriptId
