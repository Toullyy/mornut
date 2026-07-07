"""Pytest configuration and shared fixtures.

Env vars and psycopg2 stub are set BEFORE any app import so the app
loads cleanly without a real database or .env file.
"""
import os
import sys
from types import ModuleType
from unittest.mock import MagicMock

# ── 1. Set required env vars before pydantic-settings reads them ──────────────
for _key, _val in {
    "LINE_CHANNEL_SECRET": "test-channel-secret",
    "LINE_CHANNEL_ACCESS_TOKEN": "test-channel-token",
    "LINE_NOTIFY_TOKEN": "test-notify-token",
    "SLIPOK_API_KEY": "test-slipok-key",
    "SLIPOK_ENDPOINT": "https://api.slipok.test/verify",
    "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
    "JWT_SECRET": "test-jwt-secret-for-tests-only",
    "SCHEDULER_SECRET": "",
}.items():
    os.environ.setdefault(_key, _val)

# ── 2. Stub psycopg2 so app.core.db can import without the native driver ──────
_psycopg2 = ModuleType("psycopg2")
_psycopg2.connect = MagicMock()
_psycopg2.extras = ModuleType("psycopg2.extras")
_psycopg2.extras.RealDictCursor = MagicMock()
_psycopg2.pool = ModuleType("psycopg2.pool")
_psycopg2.pool.ThreadedConnectionPool = MagicMock()
sys.modules.setdefault("psycopg2", _psycopg2)
sys.modules.setdefault("psycopg2.extras", _psycopg2.extras)
sys.modules.setdefault("psycopg2.pool", _psycopg2.pool)

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_admin_user, get_line_user_id
from app.main import app


@pytest.fixture
def client():
    """TestClient with both auth dependencies stubbed out."""
    app.dependency_overrides[get_line_user_id] = lambda: "u_test_patient"
    app.dependency_overrides[get_admin_user] = lambda: {"uid": "admin_uid"}
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
