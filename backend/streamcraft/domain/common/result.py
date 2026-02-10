"""Compatibility re-export for shared Result utilities."""

from streamcraft.domain.shared.result import (
    Err,
    Failure,
    Ok,
    Result,
    Success,
    err,
    ok,
)

__all__ = [
    "Result",
    "Success",
    "Failure",
    "Ok",
    "Err",
    "ok",
    "err",
]
