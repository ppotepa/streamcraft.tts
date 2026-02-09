"""Get transcript command."""

from dataclasses import dataclass

from streamcraft.domain.transcription import TranscriptionId


@dataclass(frozen=True)
class GetTranscriptCommand:
    """Command to retrieve a transcription."""

    transcription_id: TranscriptionId
