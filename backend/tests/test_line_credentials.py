"""LINE credential resolution: DB per-clinic row is source of truth, ENV is fallback.

Pure — patches the cache boundary so no DB/network is touched.
"""
from unittest.mock import patch

from app.core.config import settings
from app.services import line


class TestResolveAccessToken:
    def test_db_token_is_source_of_truth(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_access_token", "env-token")
        with patch.object(line.app_cache, "get_line_credentials",
                          return_value={"channel_access_token": "db-token"}):
            assert line.resolve_access_token() == "db-token"

    def test_falls_back_to_env_when_no_db_row(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_access_token", "env-token")
        with patch.object(line.app_cache, "get_line_credentials", return_value=None):
            assert line.resolve_access_token() == "env-token"

    def test_falls_back_to_env_when_db_token_blank(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_access_token", "env-token")
        with patch.object(line.app_cache, "get_line_credentials",
                          return_value={"channel_access_token": ""}):
            assert line.resolve_access_token() == "env-token"

    def test_no_clinic_id_skips_db_and_uses_env(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "")
        monkeypatch.setattr(settings, "line_channel_access_token", "env-token")
        with patch.object(line.app_cache, "get_line_credentials") as m:
            assert line.resolve_access_token() == "env-token"
            m.assert_not_called()

    def test_db_error_falls_back_to_env(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_access_token", "env-token")
        with patch.object(line.app_cache, "get_line_credentials",
                          side_effect=RuntimeError("db down")):
            assert line.resolve_access_token() == "env-token"


class TestResolveChannelSecret:
    def test_db_secret_is_source_of_truth(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_secret", "env-secret")
        with patch.object(line.app_cache, "get_line_credentials",
                          return_value={"channel_secret": "db-secret"}):
            assert line.resolve_channel_secret() == "db-secret"

    def test_falls_back_to_env_secret(self, monkeypatch):
        monkeypatch.setattr(settings, "clinic_id", "c1")
        monkeypatch.setattr(settings, "line_channel_secret", "env-secret")
        with patch.object(line.app_cache, "get_line_credentials", return_value=None):
            assert line.resolve_channel_secret() == "env-secret"
