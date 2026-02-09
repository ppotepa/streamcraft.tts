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


def create_vod_id(value: str) -> VodId:
    """Create a VodId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("VodId must be a non-empty string")
    return VodId(value)


def create_segment_id(value: str) -> SegmentId:
    """Create a SegmentId with validation."""
    if not value or not isinstance(value, str):
        raise ValueError("SegmentId must be a non-empty string")
    return SegmentId(value)
