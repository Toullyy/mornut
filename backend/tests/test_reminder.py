"""Tests for the appointment reminder flow.

All DB and LINE API calls are mocked — no real PostgreSQL or LINE connection needed.
"""
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest


# ── Shared fixtures ───────────────────────────────────────────────────────────

def _booking(
    bid="book-001",
    patient_line_id="Uabc123",
    patient_name="กานดา ลือชา",
    service_name="ตรวจทั่วไป",
    status="confirmed",
    time="09:00",
    date_offset=1,
):
    target = (date.today() + timedelta(days=date_offset)).isoformat()
    return {
        "id": bid,
        "clinic_id": "clinic-001",
        "patient_line_id": patient_line_id,
        "patient_name": patient_name,
        "phone": "086-000-0001",
        "service_id": "svc-001",
        "service_name": service_name,
        "deposit_amount": 200.0,
        "date": target,
        "time": time,
        "coverage": "cash",
        "status": status,
    }


_DEFAULT_CLINIC_SETTINGS = {
    "clinic_id": "clinic-001",
    "name": "คลินิกทดสอบ",
    "reminder_enabled": True,
    "reminder_days_before": 1,
    "reminder_time": "18:00",
    "cancel_ttl_minutes": 15,
}


# ── Unit tests: reminder service logic ───────────────────────────────────────

class TestSendAppointmentReminders:
    """send_appointment_reminders() sends Flex pushes to confirmed patients."""

    @pytest.mark.asyncio
    async def test_sends_flex_to_confirmed_patients(self):
        bookings = [_booking("b1", "Uaaa"), _booking("b2", "Ubbb")]
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=bookings),
            patch("app.services.reminder.repo.mark_reminded") as mock_mark,
            patch("app.services.reminder.push_appointment_reminder", new=AsyncMock()) as mock_push,
        ):
            from app.services import reminder
            count = await reminder.send_appointment_reminders("clinic-001", days_before=1)

        assert count == 2
        assert mock_push.call_count == 2
        assert mock_mark.call_count == 2

    @pytest.mark.asyncio
    async def test_skips_walkin_bookings(self):
        bookings = [
            _booking("b1", "Ureal"),
            _booking("b2", "walk-in"),   # no LINE account
        ]
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=bookings),
            patch("app.services.reminder.repo.mark_reminded") as mock_mark,
            patch("app.services.reminder.push_appointment_reminder", new=AsyncMock()) as mock_push,
        ):
            from app.services import reminder
            count = await reminder.send_appointment_reminders("clinic-001", days_before=1)

        assert count == 1
        assert mock_push.call_count == 1
        assert mock_mark.call_count == 1

    @pytest.mark.asyncio
    async def test_skips_empty_line_id(self):
        bookings = [_booking("b1", ""), _booking("b2", "Uok")]
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=bookings),
            patch("app.services.reminder.repo.mark_reminded") as mock_mark,
            patch("app.services.reminder.push_appointment_reminder", new=AsyncMock()) as mock_push,
        ):
            from app.services import reminder
            count = await reminder.send_appointment_reminders("clinic-001", days_before=1)

        assert count == 1
        assert mock_mark.call_count == 1

    @pytest.mark.asyncio
    async def test_push_failure_is_non_fatal(self):
        """A LINE push error should not stop other bookings from being sent."""
        bookings = [_booking("b1", "Ufail"), _booking("b2", "Uok")]
        push_mock = AsyncMock(side_effect=[Exception("LINE error"), None])
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=bookings),
            patch("app.services.reminder.repo.mark_reminded") as mock_mark,
            patch("app.services.reminder.push_appointment_reminder", new=push_mock),
        ):
            from app.services import reminder
            count = await reminder.send_appointment_reminders("clinic-001", days_before=1)

        assert count == 1          # only the successful one counted
        assert mock_mark.call_count == 1

    @pytest.mark.asyncio
    async def test_no_bookings_returns_zero(self):
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=[]),
            patch("app.services.reminder.push_appointment_reminder", new=AsyncMock()) as mock_push,
        ):
            from app.services import reminder
            count = await reminder.send_appointment_reminders("clinic-001", days_before=1)

        assert count == 0
        mock_push.assert_not_called()

    @pytest.mark.asyncio
    async def test_target_date_respects_days_before(self):
        """The DB query should target today + days_before."""
        captured = {}
        def fake_get(clinic_id, d):
            captured["date"] = d
            return []

        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", side_effect=fake_get),
        ):
            from app.services import reminder
            await reminder.send_appointment_reminders("clinic-001", days_before=3)

        expected = (date.today() + timedelta(days=3)).isoformat()
        assert captured["date"] == expected

    @pytest.mark.asyncio
    async def test_push_called_with_correct_args(self):
        b = _booking("book-xyz", "Uabc", patient_name="สมชาย ใจดี",
                     service_name="ตรวจเลือด", time="10:30", date_offset=2)
        push_mock = AsyncMock()
        with (
            patch("app.services.reminder.repo.get_confirmed_bookings_for_date", return_value=[b]),
            patch("app.services.reminder.repo.mark_reminded"),
            patch("app.services.reminder.push_appointment_reminder", new=push_mock),
        ):
            from app.services import reminder
            await reminder.send_appointment_reminders("clinic-001", days_before=2)

        push_mock.assert_awaited_once()
        kwargs = push_mock.call_args.kwargs
        assert kwargs["user_id"] == "Uabc"
        assert kwargs["booking_id"] == "book-xyz"
        assert kwargs["patient_name"] == "สมชาย ใจดี"
        assert kwargs["service_name"] == "ตรวจเลือด"
        assert kwargs["time"] == "10:30"
        assert kwargs["days_before"] == 2


class TestSendRemindersFromSettings:
    """send_reminders_from_settings() reads clinic config before sending."""

    @pytest.mark.asyncio
    async def test_disabled_skips_all(self):
        settings = {**_DEFAULT_CLINIC_SETTINGS, "reminder_enabled": False}
        with (
            patch("app.services.reminder.repo.get_clinic_settings", return_value=settings),
            patch("app.services.reminder.send_appointment_reminders", new=AsyncMock()) as mock_send,
        ):
            from app.services import reminder
            count = await reminder.send_reminders_from_settings("clinic-001")

        assert count == 0
        mock_send.assert_not_called()

    @pytest.mark.asyncio
    async def test_enabled_uses_days_before_from_db(self):
        settings = {**_DEFAULT_CLINIC_SETTINGS, "reminder_days_before": 2}
        with (
            patch("app.services.reminder.repo.get_clinic_settings", return_value=settings),
            patch("app.services.reminder.send_appointment_reminders", new=AsyncMock(return_value=5)) as mock_send,
        ):
            from app.services import reminder
            count = await reminder.send_reminders_from_settings("clinic-001")

        assert count == 5
        mock_send.assert_awaited_once_with("clinic-001", 2)

    @pytest.mark.asyncio
    async def test_missing_settings_uses_defaults(self):
        with (
            patch("app.services.reminder.repo.get_clinic_settings", return_value=None),
            patch("app.services.reminder.send_appointment_reminders", new=AsyncMock(return_value=1)) as mock_send,
        ):
            from app.services import reminder
            await reminder.send_reminders_from_settings("clinic-001")

        mock_send.assert_awaited_once_with("clinic-001", 1)


# ── Unit tests: Flex message structure ───────────────────────────────────────

class TestPushAppointmentReminderFlex:
    """push_appointment_reminder() builds the right Flex payload."""

    @pytest.mark.asyncio
    async def test_flex_structure(self):
        push_flex_mock = AsyncMock()
        with patch("app.services.line.push_flex", new=push_flex_mock):
            from app.services.line import push_appointment_reminder
            await push_appointment_reminder(
                user_id="Utest",
                booking_id="abcdef1234567890",
                patient_name="กานดา ลือชา",
                date="2026-07-10",
                time="09:00",
                service_name="ตรวจทั่วไป",
                days_before=1,
            )

        push_flex_mock.assert_awaited_once()
        _user_id, alt_text, contents = push_flex_mock.call_args.args
        assert _user_id == "Utest"
        assert "09:00" in alt_text
        assert contents["type"] == "bubble"
        # Header should be amber for reminders
        assert contents["header"]["backgroundColor"] == "#F59E0B"
        # Body rows should include patient name and service
        body_texts = [
            c.get("contents", [{}])[1].get("text", "")
            for c in contents["body"]["contents"]
            if c.get("type") == "box"
        ]
        assert "กานดา ลือชา" in body_texts
        assert "ตรวจทั่วไป" in body_texts

    @pytest.mark.asyncio
    async def test_booking_ref_last_8_chars(self):
        push_flex_mock = AsyncMock()
        with patch("app.services.line.push_flex", new=push_flex_mock):
            from app.services.line import push_appointment_reminder
            await push_appointment_reminder(
                user_id="U1",
                booking_id="00000000-0000-0000-0000-ABCDEF123456",
                patient_name="Test",
                date="2026-07-10",
                time="09:00",
                service_name="Test",
                days_before=1,
            )

        _, _, contents = push_flex_mock.call_args.args
        body_texts = [
            c.get("contents", [{}])[1].get("text", "")
            for c in contents["body"]["contents"]
            if c.get("type") == "box"
        ]
        assert "3456".upper() in " ".join(body_texts)

    @pytest.mark.asyncio
    async def test_days_before_wording_tomorrow(self):
        push_flex_mock = AsyncMock()
        with patch("app.services.line.push_flex", new=push_flex_mock):
            from app.services.line import push_appointment_reminder
            await push_appointment_reminder("U1", "bid", "N", "2026-07-10", "09:00", "S", days_before=1)

        _, _, contents = push_flex_mock.call_args.args
        header_text = contents["header"]["contents"][0]["text"]
        assert "พรุ่งนี้" in header_text

    @pytest.mark.asyncio
    async def test_days_before_wording_multi_day(self):
        push_flex_mock = AsyncMock()
        with patch("app.services.line.push_flex", new=push_flex_mock):
            from app.services.line import push_appointment_reminder
            await push_appointment_reminder("U1", "bid", "N", "2026-07-10", "09:00", "S", days_before=3)

        _, _, contents = push_flex_mock.call_args.args
        header_text = contents["header"]["contents"][0]["text"]
        assert "3 วัน" in header_text


# ── Integration tests: admin API endpoints ────────────────────────────────────

class TestNotificationSettingsEndpoints:
    """GET/PUT /admin/notification-settings."""

    def test_get_returns_defaults_when_no_row(self, client):
        with patch("app.services.database.get_clinic_settings", return_value=None):
            resp = client.get("/admin/notification-settings?clinic_id=clinic-001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reminder_enabled"] is True
        assert data["reminder_days_before"] == 1
        assert data["reminder_time"] == "18:00"
        assert data["cancel_ttl_minutes"] == 15

    def test_get_returns_stored_values(self, client):
        row = {**_DEFAULT_CLINIC_SETTINGS, "reminder_days_before": 2, "reminder_enabled": False}
        with patch("app.services.database.get_clinic_settings", return_value=row):
            resp = client.get("/admin/notification-settings?clinic_id=clinic-001")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reminder_days_before"] == 2
        assert data["reminder_enabled"] is False

    def test_put_saves_settings(self, client):
        updated = {**_DEFAULT_CLINIC_SETTINGS, "reminder_days_before": 3, "reminder_time": "19:00"}
        with patch("app.services.database.upsert_clinic_settings", return_value=updated) as mock_upsert:
            resp = client.put(
                "/admin/notification-settings?clinic_id=clinic-001",
                json={"reminder_days_before": 3, "reminder_time": "19:00"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["reminder_days_before"] == 3
        assert data["reminder_time"] == "19:00"
        mock_upsert.assert_called_once()

    def test_put_requires_auth(self):
        from app.main import app as fastapi_app
        from fastapi.testclient import TestClient
        plain_client = TestClient(fastapi_app)
        resp = plain_client.put("/admin/notification-settings", json={"reminder_enabled": False})
        assert resp.status_code == 401


class TestTriggerNowEndpoint:
    """POST /admin/reminders/trigger-now."""

    def test_returns_count(self, client):
        with patch(
            "app.services.reminder.send_reminders_from_settings",
            new=AsyncMock(return_value=4),
        ):
            resp = client.post("/admin/reminders/trigger-now?clinic_id=clinic-001")
        assert resp.status_code == 200
        assert resp.json() == {"reminders_sent": 4}

    def test_zero_when_no_eligible_bookings(self, client):
        with patch(
            "app.services.reminder.send_reminders_from_settings",
            new=AsyncMock(return_value=0),
        ):
            resp = client.post("/admin/reminders/trigger-now?clinic_id=clinic-001")
        assert resp.status_code == 200
        assert resp.json()["reminders_sent"] == 0

    def test_requires_auth(self):
        from app.main import app as fastapi_app
        from fastapi.testclient import TestClient
        plain_client = TestClient(fastapi_app)
        resp = plain_client.post("/admin/reminders/trigger-now")
        assert resp.status_code == 401


class TestInternalSchedulerEndpoint:
    """POST /internal/remind/{clinic_id} — Cloud Scheduler entry point."""

    def test_success(self, client, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "scheduler_secret", "")
        with patch(
            "app.services.reminder.send_tomorrow_reminders",
            new=AsyncMock(return_value=3),
        ):
            resp = client.post(
                "/internal/remind/clinic-001",
                headers={"Authorization": "Bearer any"},
            )
        assert resp.status_code == 200
        assert resp.json()["reminders_sent"] == 3

    def test_wrong_secret_rejected(self, client, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "scheduler_secret", "real-secret")
        resp = client.post(
            "/internal/remind/clinic-001",
            headers={"Authorization": "Bearer wrong"},
        )
        assert resp.status_code == 401

    def test_correct_secret_accepted(self, client, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "scheduler_secret", "my-secret")
        with patch(
            "app.services.reminder.send_tomorrow_reminders",
            new=AsyncMock(return_value=0),
        ):
            resp = client.post(
                "/internal/remind/clinic-001",
                headers={"Authorization": "Bearer my-secret"},
            )
        assert resp.status_code == 200
