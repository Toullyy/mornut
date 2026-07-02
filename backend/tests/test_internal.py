from unittest.mock import AsyncMock, patch

from app.core.config import settings


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
    with patch("app.services.firestore.update_booking") as mock_fn:
        resp = client.patch(
            "/admin/bookings/booking-001/status",
            json={"status": "done"},
        )
    assert resp.status_code == 204
    mock_fn.assert_called_once_with("booking-001", {"status": "done"})


def test_remind_admin_cancel(client):
    with patch("app.services.firestore.cancel_booking") as mock_fn:
        resp = client.patch(
            "/admin/bookings/booking-001/status",
            json={"status": "cancelled"},
        )
    assert resp.status_code == 204
    mock_fn.assert_called_once_with("booking-001")
