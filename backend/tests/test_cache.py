"""Golden tests for the in-process TTL cache.

All pure — no DB, no network, no async. Uses monkeypatching to control time.
"""
import time

import pytest

from app.services.cache import _TTLCache, get_clinic_settings, get_services, invalidate
from app.services.cache import _settings, _services, _chunks


# ── _TTLCache unit tests ──────────────────────────────────────────────────────

class TestTTLCache:
    def setup_method(self):
        self.cache = _TTLCache(ttl=60, max_size=3)

    def test_miss_on_empty_cache(self):
        hit, val = self.cache.get("k")
        assert not hit
        assert val is None

    def test_set_then_get_returns_hit(self):
        self.cache.set("k", {"data": 1})
        hit, val = self.cache.get("k")
        assert hit
        assert val == {"data": 1}

    def test_delete_removes_entry(self):
        self.cache.set("k", "v")
        self.cache.delete("k")
        hit, _ = self.cache.get("k")
        assert not hit

    def test_delete_missing_key_is_noop(self):
        self.cache.delete("nonexistent")  # must not raise

    def test_expired_entry_returns_miss(self, monkeypatch):
        t0 = time.monotonic()
        self.cache.set("k", "v")
        monkeypatch.setattr(time, "monotonic", lambda: t0 + 61)
        hit, _ = self.cache.get("k")
        assert not hit

    def test_not_expired_within_ttl(self, monkeypatch):
        t0 = time.monotonic()
        self.cache.set("k", "v")
        monkeypatch.setattr(time, "monotonic", lambda: t0 + 59)
        hit, val = self.cache.get("k")
        assert hit
        assert val == "v"

    def test_eviction_when_at_max_size(self):
        self.cache.set("a", 1)
        self.cache.set("b", 2)
        self.cache.set("c", 3)
        assert self.cache.size() == 3
        self.cache.set("d", 4)  # triggers eviction of first entry
        assert self.cache.size() == 3

    def test_size_reflects_stored_count(self):
        assert self.cache.size() == 0
        self.cache.set("x", 1)
        assert self.cache.size() == 1

    def test_overwrite_existing_key(self):
        self.cache.set("k", "old")
        self.cache.set("k", "new")
        hit, val = self.cache.get("k")
        assert hit
        assert val == "new"


# ── Helper function tests ─────────────────────────────────────────────────────

class TestCacheHelpers:
    def setup_method(self):
        # Clear module-level caches before each test
        invalidate("test-clinic")

    def test_get_clinic_settings_calls_loader_on_miss(self):
        calls = []
        def loader(cid):
            calls.append(cid)
            return {"name": "Test Clinic"}

        result = get_clinic_settings("test-clinic", loader)
        assert result == {"name": "Test Clinic"}
        assert calls == ["test-clinic"]

    def test_get_clinic_settings_uses_cache_on_second_call(self):
        calls = []
        def loader(cid):
            calls.append(cid)
            return {"name": "Test Clinic"}

        get_clinic_settings("test-clinic", loader)
        get_clinic_settings("test-clinic", loader)
        assert len(calls) == 1  # loader called only once

    def test_get_services_caches_result(self):
        calls = []
        def loader(cid):
            calls.append(cid)
            return [{"id": "svc1", "name": "ตรวจทั่วไป"}]

        get_services("test-clinic", loader)
        get_services("test-clinic", loader)
        assert len(calls) == 1

    def test_invalidate_clears_all_caches(self):
        settings_calls = []
        services_calls = []

        get_clinic_settings("test-clinic", lambda cid: settings_calls.append(cid) or {})
        get_services("test-clinic", lambda cid: services_calls.append(cid) or [])

        invalidate("test-clinic")

        get_clinic_settings("test-clinic", lambda cid: settings_calls.append(cid) or {})
        get_services("test-clinic", lambda cid: services_calls.append(cid) or [])

        assert len(settings_calls) == 2
        assert len(services_calls) == 2

    def test_different_clinics_cached_independently(self):
        calls = []
        def loader(cid):
            calls.append(cid)
            return {}

        get_clinic_settings("clinic-A", loader)
        get_clinic_settings("clinic-B", loader)
        get_clinic_settings("clinic-A", loader)  # cache hit

        assert calls == ["clinic-A", "clinic-B"]

    def test_invalidate_one_clinic_does_not_affect_other(self):
        def loader_a(cid):
            return {"clinic": "A"}
        def loader_b(cid):
            return {"clinic": "B"}

        get_clinic_settings("clinic-A", loader_a)
        get_clinic_settings("clinic-B", loader_b)
        invalidate("clinic-A")

        # clinic-B should still be cached
        b_calls = []
        get_clinic_settings("clinic-B", lambda cid: b_calls.append(cid) or {"clinic": "B"})
        assert b_calls == []  # no loader call = cache hit
