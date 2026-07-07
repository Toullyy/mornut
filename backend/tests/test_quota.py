from unittest.mock import patch

_QUOTA_RAW = {
    "cash": {"limit": 10, "used": 3},
    "sso": {"limit": 5, "used": 1},
    "universal": {"limit": 5, "used": 0},
}


def test_get_quota(client):
    with patch("app.services.database.get_quota", return_value=_QUOTA_RAW):
        resp = client.get("/quotas/clinic-001/2026-07-10")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cash"]["limit"] == 10
    assert data["cash"]["used"] == 3
    assert data["cash"]["remaining"] == 7
    assert data["sso"]["remaining"] == 4
    assert data["universal"]["remaining"] == 5


def test_set_quota_success(client):
    with patch("app.services.database.update_quota_limits") as mock_fn:
        resp = client.put(
            "/quotas/clinic-001/2026-07-10",
            json={"cash": 12, "sso": 6, "universal": 6},
        )
    assert resp.status_code == 204
    mock_fn.assert_called_once_with("clinic-001", "2026-07-10", 12, 6, 6)


def test_set_quota_requires_admin(client):
    from app.main import app
    from app.core.security import get_admin_user

    # Remove the admin override so it raises 401
    app.dependency_overrides.pop(get_admin_user, None)
    try:
        resp = client.put(
            "/quotas/clinic-001/2026-07-10",
            json={"cash": 10, "sso": 5, "universal": 5},
        )
        assert resp.status_code == 401
    finally:
        app.dependency_overrides[get_admin_user] = lambda: {"uid": "admin_uid"}


def test_set_quota_invalid_body(client):
    resp = client.put(
        "/quotas/clinic-001/2026-07-10",
        json={"cash": "not-a-number"},
    )
    assert resp.status_code == 422
