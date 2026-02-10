"""
Memory-based repository for transcriptions (testing/development).
"""

from typing import Dict, Optional
from streamcraft.domain.shared.branded_types import TranscriptId, create_transcript_id
from streamcraft.domain.shared.result import Result, Success, Failure
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.ports.transcription_repository import TranscriptionRepository


class MemoryTranscriptionRepository(TranscriptionRepository):
    """In-memory implementation of TranscriptionRepository for testing."""

    def __init__(self) -> None:
        """Initialize empty in-memory storage."""
        self._storage: Dict[TranscriptId, Transcript] = {}

    async def save(self, transcript: Transcript) -> Result[Transcript, Exception]:
        """Save transcript to memory."""
        try:
            self._storage[transcript.id] = transcript
            return Success(transcript)
        except Exception as e:
            return Failure(e)

    async def find_by_id(
        self, transcript_id: TranscriptId
    ) -> Result[Optional[Transcript], Exception]:
        """Find transcript by ID in memory."""
        try:
            transcript = self._storage.get(transcript_id)
            return Success(transcript)
        except Exception as e:
            return Failure(e)

    async def delete(self, transcript_id: TranscriptId) -> Result[bool, Exception]:
        """Delete transcript from memory."""
        try:
            if transcript_id in self._storage:
                del self._storage[transcript_id]
                return Success(True)
            return Success(False)
        except Exception as e:
            return Failure(e)

    def clear(self) -> None:
        """Clear all transcripts (useful for testing)."""
        self._storage.clear()
