from datetime import datetime, timezone
from unittest.mock import patch

_NOW = datetime(2026, 7, 10, 9, 0, 0, tzinfo=timezone.utc)

_BOOKING_RAW = {
    "id": "booking-001",
    "clinicId": "clinic-001",
    "patientLineId": "u_test_patient",
    "patientName": "Test Patient",
    "phone": "0812345678",
    "serviceId": "svc-001",
    "serviceName": "Test Service",
    "depositAmount": 200.0,
    "date": "2026-07-10",
    "time": "09:00",
    "coverage": "cash",
    "status": "pending_slip",
    "createdAt": _NOW,
    "updatedAt": _NOW,
}

_PAYLOAD = {
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
}


def test_create_booking_success(client):
    with (
        patch("app.services.firestore.create_booking", return_value="booking-001"),
        patch("app.services.firestore.get_booking", return_value=_BOOKING_RAW),
    ):
        resp = client.post("/bookings", json=_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == "booking-001"
    assert data["status"] == "pending_slip"
    assert data["service_name"] == "Test Service"
    assert data["deposit_amount"] == 200.0


def test_create_booking_full_slot(client):
    with patch(
        "app.services.firestore.create_booking",
        side_effect=ValueError("เวลา 09:00 เต็มแล้ว"),
    ):
        resp = client.post("/bookings", json=_PAYLOAD)
    assert resp.status_code == 409
    assert "เต็มแล้ว" in resp.json()["detail"]


def test_create_booking_full_quota(client):
    with patch(
        "app.services.firestore.create_booking",
        side_effect=ValueError("สิทธิ์ cash เต็มในวันนี้"),
    ):
        resp = client.post("/bookings", json=_PAYLOAD)
    assert resp.status_code == 409


def test_create_booking_invalid_date(client):
    bad = {**_PAYLOAD, "date": "not-a-date"}
    resp = client.post("/bookings", json=bad)
    assert resp.status_code == 422


def test_get_booking_success(client):
    with patch("app.services.firestore.get_booking", return_value=_BOOKING_RAW):
        resp = client.get("/bookings/booking-001")
    assert resp.status_code == 200
    assert resp.json()["patient_name"] == "Test Patient"


def test_get_booking_not_found(client):
    with patch("app.services.firestore.get_booking", return_value=None):
        resp = client.get("/bookings/nonexistent")
    assert resp.status_code == 404


def test_cancel_booking(client):
    # patch push_text where booking_service imported it (not at origin)
    with (
        patch("app.services.firestore.cancel_booking"),
        patch("app.services.firestore.get_booking", return_value=_BOOKING_RAW),
        patch("app.services.booking_service.push_text"),
    ):
        resp = client.delete("/bookings/booking-001")
    assert resp.status_code == 204
