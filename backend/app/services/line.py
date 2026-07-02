import httpx

from linebot.v3.messaging import (
    AsyncApiClient,
    AsyncMessagingApi,
    Configuration,
    FlexMessage,
    PushMessageRequest,
    ReplyMessageRequest,
    TextMessage,
)

from app.core.config import settings


def _cfg() -> Configuration:
    return Configuration(access_token=settings.line_channel_access_token)


async def reply_text(reply_token: str, text: str) -> None:
    async with AsyncApiClient(_cfg()) as client:
        await AsyncMessagingApi(client).reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=text)],
            )
        )


async def push_text(user_id: str, text: str) -> None:
    async with AsyncApiClient(_cfg()) as client:
        await AsyncMessagingApi(client).push_message(
            PushMessageRequest(
                to=user_id,
                messages=[TextMessage(text=text)],
            )
        )


async def push_flex(user_id: str, alt_text: str, contents: dict) -> None:
    """Push a Flex Message. `contents` is a raw LINE Flex container dict."""
    async with AsyncApiClient(_cfg()) as client:
        await AsyncMessagingApi(client).push_message(
            PushMessageRequest(
                to=user_id,
                messages=[FlexMessage(alt_text=alt_text, contents=contents)],
            )
        )


def _row(label: str, value: str) -> dict:
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            {"type": "text", "text": label, "color": "#888888", "size": "sm", "flex": 3},
            {"type": "text", "text": value, "size": "sm", "flex": 7, "weight": "bold", "wrap": True},
        ],
    }


async def push_booking_confirmed(
    user_id: str,
    booking_id: str,
    patient_name: str,
    date: str,
    time: str,
    service_name: str,
) -> None:
    """Push a Flex Message confirming that the slip was verified and booking is confirmed."""
    short_id = booking_id[-8:].upper()
    contents = {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#06C755",
            "paddingAll": "16px",
            "contents": [
                {
                    "type": "text",
                    "text": "✅ ยืนยันการจองแล้ว",  # ✅ ยืนยันการจองแล้ว
                    "color": "#ffffff",
                    "weight": "bold",
                    "size": "lg",
                }
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "paddingAll": "16px",
            "contents": [
                _row("ชื่อ", patient_name),       # ชื่อ
                _row("บริการ", service_name),  # บริการ
                _row("วันที่", date),   # วันที่
                _row("เวลา", f"{time} น."),  # เวลา / น.
                _row("รหัส", short_id),           # รหัส
            ],
        },
    }
    await push_flex(user_id, "ยืนยันการจอง", contents)  # ยืนยันการจอง


async def send_line_notify(message: str) -> None:
    """POST to LINE Notify API to push a text message to the subscribed group."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {settings.line_notify_token}"},
            data={"message": message},
        )
        resp.raise_for_status()
