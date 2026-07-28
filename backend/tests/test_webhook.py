"""Webhook signature-verification guardrails."""
from unittest.mock import patch


def test_unconfigured_secret_is_rejected_not_verified_with_empty_key(client):
    """A fresh deploy with no DB row and no ENV secret must fail closed.

    Otherwise HMAC would run with an empty key — forgeable by anyone."""
    with patch(
        "app.routers.webhook.line_service.resolve_channel_secret",
        return_value="",
    ):
        resp = client.post(
            "/webhook",
            content=b"{}",
            headers={"X-Line-Signature": "anything"},
        )
    assert resp.status_code == 503


def test_bad_signature_rejected_when_secret_present(client):
    """With a secret configured, a wrong signature is rejected (400)."""
    with patch(
        "app.routers.webhook.line_service.resolve_channel_secret",
        return_value="real-secret",
    ):
        resp = client.post(
            "/webhook",
            content=b'{"events":[]}',
            headers={"X-Line-Signature": "wrong-signature"},
        )
    assert resp.status_code == 400
