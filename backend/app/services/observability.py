"""§8 Observability utilities.

log_internal_error: wraps try/except "never raise" paths so errors surface
as [SILENT-FAIL] console logs and DB entries, not silent swallows.
timed: context manager that records elapsed milliseconds.
"""
import sys
import time
from contextlib import contextmanager
from typing import Generator

from app.services import database as repo


def log_internal_error(tag: str, error: Exception) -> None:
    """Log a non-fatal internal error to stderr and to the internal_errors table.

    Use this inside every except block that must never re-raise, so errors
    surface on the console / monitoring instead of disappearing silently.
    """
    print(f"[SILENT-FAIL][{tag}] {error}", file=sys.stderr)
    asyncio_safe_save(tag, str(error))


def asyncio_safe_save(tag: str, message: str) -> None:
    """Best-effort DB write — uses a plain sync call (safe from any context)."""
    try:
        repo.save_internal_error(tag, message)
    except Exception as e2:
        print(f"[SILENT-FAIL] could not persist error to DB: {e2}", file=sys.stderr)


@contextmanager
def timed() -> Generator[dict, None, None]:
    """Yield a mutable dict; after the block, dict['latency_ms'] is set."""
    data: dict = {}
    start = time.monotonic()
    try:
        yield data
    finally:
        data["latency_ms"] = int((time.monotonic() - start) * 1000)
