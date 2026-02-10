"""Transcription repository port."""

from abc import ABC, abstractmethod

from streamcraft.domain.shared.branded_types import TranscriptId
from streamcraft.domain.shared.result import Result
from streamcraft.domain.transcription.entities.transcript import Transcript
from streamcraft.domain.transcription.errors.transcription_errors import TranscriptionNotFoundError


class TranscriptionRepository(ABC):
    """Port for persisting and retrieving transcriptions."""

    @abstractmethod
    def save(self, transcript: Transcript) -> Result[Transcript, Exception]:
        """Save a transcript."""
        ...

    @abstractmethod
    def find_by_id(self, transcript_id: TranscriptId) -> Result[Transcript, TranscriptionNotFoundError]:
        """Find a transcript by its ID."""
        ...

    @abstractmethod
    def list_all(self) -> Result[list[Transcript], Exception]:
        """List all transcripts."""
        ...

    @abstractmethod
    def delete(self, transcript_id: TranscriptId) -> Result[bool, TranscriptionNotFoundError]:
        """Delete a transcript."""
        ...
