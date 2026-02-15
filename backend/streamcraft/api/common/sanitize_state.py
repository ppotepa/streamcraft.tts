"""Shared sanitize route runtime state and utilities."""

import datetime
import threading

_sanitize_cancel_lock = threading.Lock()
_sanitize_cancel_events: dict[str, threading.Event] = {}


def get_sanitize_cancel_event(job_id: str) -> threading.Event:
    with _sanitize_cancel_lock:
        event = _sanitize_cancel_events.get(job_id)
        if not event:
            event = threading.Event()
            _sanitize_cancel_events[job_id] = event
        return event


def clear_sanitize_cancel_event(job_id: str) -> None:
    with _sanitize_cancel_lock:
        _sanitize_cancel_events.pop(job_id, None)


def timestamp_logs(lines: list[str]) -> list[str]:
    now = datetime.datetime.now(datetime.UTC)
    stamped: list[str] = []
    for idx, line in enumerate(lines):
        stamp = (now + datetime.timedelta(seconds=idx)).strftime("%H:%M:%S")
        stamped.append(f"[{stamp}] {line}")
    if not lines:
        stamped.append(f"[{now.strftime('%H:%M:%S')}] sanitize completed (no log emitted)")
    return stamped
