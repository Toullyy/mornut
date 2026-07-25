"""§9 In-process TTL cache — reduces DB hits on per-clinic data.

Every inbound LINE message triggers 2–3 DB queries for clinic settings,
services, and knowledge chunks. This cache drops those to ~0 after the
first request within the TTL window.

No Redis: a single in-process dict is enough for a single-worker deployment.
For multi-worker: replace the three _TTLCache instances with Redis-backed ones
while keeping the same interface — callers never change.

Never raises — cache misses fall through to the loader transparently.
"""
import time
from typing import Any, Callable

_TTL = 60        # seconds before a cached entry expires
_MAX_SIZE = 500  # entries per cache (guards against unbounded memory growth)


class _TTLCache:
    def __init__(self, ttl: int = _TTL, max_size: int = _MAX_SIZE) -> None:
        self._d: dict[str, tuple[Any, float]] = {}
        self._ttl = ttl
        self._max = max_size

    def get(self, key: str) -> tuple[bool, Any]:
        """Return (hit, value). hit=False means expired or missing."""
        entry = self._d.get(key)
        if entry is None:
            return False, None
        value, exp = entry
        if time.monotonic() > exp:
            del self._d[key]
            return False, None
        return True, value

    def set(self, key: str, value: Any) -> None:
        if len(self._d) >= self._max:
            try:
                del self._d[next(iter(self._d))]
            except StopIteration:
                pass
        self._d[key] = (value, time.monotonic() + self._ttl)

    def delete(self, key: str) -> None:
        self._d.pop(key, None)

    def size(self) -> int:
        return len(self._d)


_settings: _TTLCache = _TTLCache()
_services: _TTLCache = _TTLCache()
_chunks: _TTLCache = _TTLCache()


def get_clinic_settings(clinic_id: str, loader: Callable[[str], Any]) -> Any:
    """Return cached clinic_settings, calling loader on miss. Sync — call via to_thread."""
    hit, val = _settings.get(clinic_id)
    if hit:
        return val
    result = loader(clinic_id)
    _settings.set(clinic_id, result)
    return result


def get_services(clinic_id: str, loader: Callable[[str], Any]) -> list:
    """Return cached services list, calling loader on miss. Sync — call via to_thread."""
    hit, val = _services.get(clinic_id)
    if hit:
        return val
    result = loader(clinic_id)
    _services.set(clinic_id, result)
    return result


def get_knowledge_chunks(clinic_id: str, loader: Callable[[str], Any]) -> list:
    """Return cached knowledge chunks, calling loader on miss. Sync — call via to_thread."""
    hit, val = _chunks.get(clinic_id)
    if hit:
        return val
    result = loader(clinic_id)
    _chunks.set(clinic_id, result)
    return result


def invalidate(clinic_id: str) -> None:
    """Evict all cached data for a clinic.

    Call after any admin mutation: settings update, RAG rebuild, service change.
    """
    _settings.delete(clinic_id)
    _services.delete(clinic_id)
    _chunks.delete(clinic_id)
