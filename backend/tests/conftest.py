"""Pytest configuration and shared fixtures.

Env vars are set BEFORE any app import so pydantic-settings Settings()
succeeds without a real .env file present in the test environment.
"""
import os

# Must happen before any `from app.*` import
for _key, _val in {
    "LINE_CHANNEL_SECRET": "test-channel-secret",
    "LINE_CHANNEL_ACCESS_TOKEN": "test-channel-token",
    "LINE_NOTIFY_TOKEN": "test-notify-token",
    "SLIPOK_API_KEY": "test-slipok-key",
    "SLIPOK_ENDPOINT": "https://api.slipok.test/verify",
    "FIREBASE_PROJECT_ID": "test-project",
    "SCHEDULER_SECRET": "",
}.items():
    os.environ.setdefault(_key, _val)

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
