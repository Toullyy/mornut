from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings

_NOW = datetime(2026, 7, 10, 9, 0, 0, tzinfo=timezone.utc)

_BOOKING_RAW = {
    "id": "booking-001",
    "clinic_id": "clinic-001",
    "patient_line_id": "u_test_patient",
    "patient_name": "Test Patient",
    "phone": "0812345678",
    "service_id": "svc-001",
    "service_name": "Test Service",
    "deposit_amount": 200.0,
    "date": "2026-07-10",
    "time": "09:00",
    "coverage": "cash",
    "status": "confirmed",
    "slip_url": None,
    "slip_verified": False,
    "slip_amount": None,
    "slip_trans_ref": None,
    "slip_verified_at": None,
    "created_at": _NOW,
    "updated_at": _NOW,
}


def test_remind_success(client, monkeypatch):
    monkeypatch.setattr(settings, "scheduler_secret", "")
    with patch(
        "app.services.reminder.send_tomorrow_reminders",
        new=AsyncMock(return_value=3),
    ):
        resp = client.post(
            "/internal/remind/clinic-001",
            headers={"Authorization": "Bearer any-value"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["clinic_id"] == "clinic-001"
    assert data["reminders_sent"] == 3


def test_remind_correct_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "scheduler_secret", "my-secret")
    with patch(
        "app.services.reminder.send_tomorrow_reminders",
        new=AsyncMock(return_value=1),
    ):
        resp = client.post(
            "/internal/remind/clinic-001",
            headers={"Authorization": "Bearer my-secret"},
        )
    assert resp.status_code == 200


def test_remind_wrong_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "scheduler_secret", "real-secret")
    resp = client.post(
        "/internal/remind/clinic-001",
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 401


def test_remind_admin_mark_done(client):
    with patch("app.services.database.update_booking") as mock_fn:
        resp = client.patch(
            "/admin/bookings/booking-001/status",
            json={"status": "done"},
        )
    assert resp.status_code == 204
    mock_fn.assert_called_once_with("booking-001", {"status": "done"})


def test_remind_admin_cancel(client):
    with (
        patch("app.services.database.get_booking", return_value=_BOOKING_RAW),
        patch("app.services.database.cancel_booking") as mock_fn,
        patch("app.services.line.push_booking_cancelled", new=AsyncMock()),
    ):
        resp = client.patch(
            "/admin/bookings/booking-001/status",
            json={"status": "cancelled"},
        )
    assert resp.status_code == 204
    mock_fn.assert_called_once_with("booking-001")
