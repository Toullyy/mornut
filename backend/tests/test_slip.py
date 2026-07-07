from unittest.mock import AsyncMock, patch

_BOOKING_PENDING = {
    "id": "booking-001",
    "clinic_id": "clinic-001",
    "patient_line_id": "u_test_patient",
    "patient_name": "Test Patient",
    "service_id": "svc-001",
    "service_name": "Test Service",
    "date": "2026-07-10",
    "time": "09:00",
    "coverage": "cash",
    "status": "pending_slip",
    "deposit_amount": 200.0,
    "slip_url": None,
    "slip_verified": False,
    "slip_amount": None,
    "slip_trans_ref": None,
    "slip_verified_at": None,
}

_SLIP_FILE = ("slip.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image/jpeg")

_SLIPOK_OK = {"success": True, "data": {"amount": 200.0, "transRef": "TX20260710001"}}
_SLIPOK_FAKE = {"success": False, "message": "Invalid slip image"}


def _post_slip(client, booking_id="booking-001"):
    return client.post(
        f"/slips/{booking_id}/verify",
        files={"file": _SLIP_FILE},
    )


def test_verify_slip_success(client):
    with (
        patch("app.services.database.get_booking", return_value=_BOOKING_PENDING),
        patch("app.services.slipok.verify_slip_file", new=AsyncMock(return_value=_SLIPOK_OK)),
        patch("app.services.database.is_trans_ref_used", return_value=False),
        patch("app.services.storage.upload_slip", new=AsyncMock(return_value="slips/booking-001/1.jpg")),
        patch("app.services.database.update_booking"),
        patch("app.services.line.push_booking_confirmed", new=AsyncMock()),
        patch("app.services.line.send_line_notify", new=AsyncMock()),
    ):
        resp = _post_slip(client)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["amount"] == 200.0
    assert data["trans_ref"] == "TX20260710001"


def test_verify_slip_fake(client):
    with (
        patch("app.services.database.get_booking", return_value=_BOOKING_PENDING),
        patch("app.services.slipok.verify_slip_file", new=AsyncMock(return_value=_SLIPOK_FAKE)),
    ):
        resp = _post_slip(client)
    assert resp.status_code == 422
    assert "ปลอม" in resp.json()["detail"]


def test_verify_slip_insufficient_amount(client):
    low = {"success": True, "data": {"amount": 100.0, "transRef": "TX001"}}
    with (
        patch("app.services.database.get_booking", return_value=_BOOKING_PENDING),
        patch("app.services.slipok.verify_slip_file", new=AsyncMock(return_value=low)),
    ):
        resp = _post_slip(client)
    assert resp.status_code == 422
    assert "ยอดเงิน" in resp.json()["detail"]


def test_verify_slip_duplicate_trans_ref(client):
    with (
        patch("app.services.database.get_booking", return_value=_BOOKING_PENDING),
        patch("app.services.slipok.verify_slip_file", new=AsyncMock(return_value=_SLIPOK_OK)),
        patch("app.services.database.is_trans_ref_used", return_value=True),
    ):
        resp = _post_slip(client)
    assert resp.status_code == 422
    assert "ถูกใช้" in resp.json()["detail"]


def test_verify_slip_wrong_status(client):
    booking_confirmed = {**_BOOKING_PENDING, "status": "confirmed"}
    with patch("app.services.database.get_booking", return_value=booking_confirmed):
        resp = _post_slip(client)
    assert resp.status_code == 409


def test_verify_slip_not_found(client):
    with patch("app.services.database.get_booking", return_value=None):
        resp = _post_slip(client)
    assert resp.status_code == 404


def test_verify_slip_wrong_type(client):
    resp = client.post(
        "/slips/booking-001/verify",
        files={"file": ("doc.pdf", b"%PDF", "application/pdf")},
    )
    assert resp.status_code == 415
