"""Branded types for domain identifiers.

These types provide compile-time type safety by preventing mixing of different ID types.
Using NewType creates distinct types that cannot be accidentally interchanged.
"""

from typing import NewType


# Job domain
JobId = NewType("JobId", str)
StepId = NewType("StepId", str)

# VOD domain
VodId = NewType("VodId", str)
StreamerId = NewType("StreamerId", str)

# Audio domain
AudioFileId = NewType("AudioFileId", str)
SegmentId = NewType("SegmentId", str)

# Dataset domain
DatasetId = NewType("DatasetId", str)
EntryId = NewType("EntryId", str)

# Transcription domain
TranscriptId = NewType("TranscriptId", str)
CueId = NewType("CueId", str)


def create_job_id(value: str) -> JobId:
    """Create a JobId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("JobId must be a non-empty string")
    return JobId(value)


def create_step_id(value: str) -> StepId:
    """Create a StepId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("StepId must be a non-empty string")
    return StepId(value)


def create_vod_id(value: str) -> VodId:
    """Create a VodId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("VodId must be a non-empty string")
    return VodId(value)


def create_streamer_id(value: str) -> StreamerId:
    """Create a StreamerId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("StreamerId must be a non-empty string")
    return StreamerId(value)


def create_audio_file_id(value: str) -> AudioFileId:
    """Create an AudioFileId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("AudioFileId must be a non-empty string")
    return AudioFileId(value)


def create_segment_id(value: str) -> SegmentId:
    """Create a SegmentId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("SegmentId must be a non-empty string")
    return SegmentId(value)


def create_dataset_id(value: str) -> DatasetId:
    """Create a DatasetId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("DatasetId must be a non-empty string")
    return DatasetId(value)


def create_entry_id(value: str) -> EntryId:
    """Create an EntryId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("EntryId must be a non-empty string")
    return EntryId(value)


def create_transcript_id(value: str) -> TranscriptId:
    """Create a TranscriptId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("TranscriptId must be a non-empty string")
    return TranscriptId(value)


def create_cue_id(value: str) -> CueId:
    """Create a CueId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("CueId must be a non-empty string")
    return CueId(value)
