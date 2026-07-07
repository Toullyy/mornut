import io
from pathlib import Path

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

_LINE_API = "https://api.line.me"
_LINE_API_DATA = "https://api-data.line.me"
_THAI_FONT = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "Sarabun-Regular.ttf"


def _cfg(access_token: str | None = None) -> Configuration:
    return Configuration(access_token=access_token or settings.line_channel_access_token)


async def connect_line_oa(channel_secret: str, channel_access_token: str) -> dict:
    """Verify LINE OA credentials by fetching bot info. Returns bot profile on success."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.line.me/v2/bot/info",
            headers={"Authorization": f"Bearer {channel_access_token}"},
        )
        if resp.status_code == 401:
            raise ValueError("Invalid channel access token")
        resp.raise_for_status()
        return resp.json()


async def reply_text(reply_token: str, text: str) -> None:
    async with AsyncApiClient(_cfg()) as client:
        await AsyncMessagingApi(client).reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=text)],
            )
        )


async def get_profile(user_id: str) -> dict:
    """Fetch a LINE user's public profile (display name, picture) for the chat inbox."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{_LINE_API}/v2/bot/profile/{user_id}",
            headers={"Authorization": f"Bearer {settings.line_channel_access_token}"},
        )
        if resp.status_code != 200:
            return {}
        return resp.json()


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


async def push_appointment_reminder(
    user_id: str,
    booking_id: str,
    patient_name: str,
    date: str,
    time: str,
    service_name: str,
    days_before: int = 1,
) -> None:
    """Push a Flex Message reminding the patient of their upcoming appointment."""
    short_id = booking_id[-8:].upper()
    when = "พรุ่งนี้" if days_before == 1 else f"อีก {days_before} วัน"
    contents = {
        "type": "bubble",
        "size": "kilo",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#F59E0B",
            "paddingAll": "16px",
            "contents": [
                {
                    "type": "text",
                    "text": f"🔔 แจ้งเตือนนัดหมาย ({when})",
                    "color": "#ffffff",
                    "weight": "bold",
                    "size": "md",
                }
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "paddingAll": "16px",
            "contents": [
                _row("ชื่อ", patient_name),
                _row("บริการ", service_name),
                _row("วันที่", date),
                _row("เวลา", f"{time} น."),
                _row("รหัส", short_id),
                {
                    "type": "separator",
                    "margin": "md",
                },
                {
                    "type": "text",
                    "text": "กรุณาตรงเวลา หากไม่สะดวกกรุณาแจ้งยกเลิกล่วงหน้าด้วยนะคะ 🙏",
                    "size": "xs",
                    "color": "#6B7280",
                    "wrap": True,
                    "margin": "md",
                },
            ],
        },
    }
    await push_flex(user_id, f"แจ้งเตือนนัดหมาย — {date} เวลา {time} น.", contents)


async def send_line_notify(message: str) -> None:
    """POST to LINE Notify API to push a text message to the subscribed group."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {settings.line_notify_token}"},
            data={"message": message},
        )
        resp.raise_for_status()


# ── Webhook endpoint setup ──────────────────────────────────────────────────────

async def set_webhook_endpoint(access_token: str, url: str) -> None:
    """Register (or update) the channel's webhook endpoint URL via the Messaging API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(
            f"{_LINE_API}/v2/bot/channel/webhook/endpoint",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"endpoint": url},
        )
        if resp.status_code == 401:
            raise ValueError("Invalid channel access token")
        if resp.status_code == 400:
            raise ValueError(f"LINE rejected the webhook URL: {resp.text}")
        resp.raise_for_status()


# ── Rich menu ───────────────────────────────────────────────────────────────────

# 3 equal columns across the standard 2500×843 "large" rich-menu canvas.
_RICH_MENU_COLUMNS = [
    ("จองคิว", (6, 199, 85)),        # LINE green
    ("คิวของฉัน", (37, 99, 235)),    # blue
    ("ติดต่อคลินิก", (100, 116, 139)),  # slate
]


def _render_rich_menu_image(labels: list[str]) -> bytes:
    """Render a 2500×843 PNG with one accent circle + centered Thai label per column.

    Uses the bundled Sarabun font so Thai glyphs render; falls back to Pillow's
    default bitmap font (Latin only) if the font file is missing.
    """
    from PIL import Image, ImageDraw, ImageFont

    W, H, cols = 2500, 843, len(labels)
    col_w = W // cols
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    try:
        label_font = ImageFont.truetype(str(_THAI_FONT), 96)
    except OSError:
        label_font = ImageFont.load_default()

    for i, label in enumerate(labels):
        cx = i * col_w + col_w // 2
        _, color = _RICH_MENU_COLUMNS[i] if i < len(_RICH_MENU_COLUMNS) else (label, (100, 116, 139))

        # Vertical divider between columns
        if i > 0:
            x = i * col_w
            draw.line([(x, 90), (x, H - 90)], fill=(226, 232, 240), width=3)

        # Accent circle
        r = 70
        cy = H // 2 - 90
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

        # Centered label
        draw.text((cx, H // 2 + 90), label, font=label_font, fill=(30, 41, 59), anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def create_and_publish_rich_menu(
    access_token: str,
    liff_url: str,
    contact_text: str = "ติดต่อคลินิก",
) -> str:
    """Create a rich menu, upload its generated image, and set it as the default.

    Returns the new richMenuId.
    """
    labels = [c[0] for c in _RICH_MENU_COLUMNS]
    col_w = 2500 // len(labels)
    body = {
        "size": {"width": 2500, "height": 843},
        "selected": True,
        "name": "MorNut Main Menu",
        "chatBarText": "เมนู",
        "areas": [
            {
                "bounds": {"x": 0, "y": 0, "width": col_w, "height": 843},
                "action": {"type": "uri", "label": "จองคิว", "uri": liff_url},
            },
            {
                "bounds": {"x": col_w, "y": 0, "width": col_w, "height": 843},
                "action": {"type": "uri", "label": "คิวของฉัน", "uri": liff_url},
            },
            {
                "bounds": {"x": 2 * col_w, "y": 0, "width": 2500 - 2 * col_w, "height": 843},
                "action": {"type": "message", "label": "ติดต่อ", "text": contact_text},
            },
        ],
    }

    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Create the rich menu object
        resp = await client.post(
            f"{_LINE_API}/v2/bot/richmenu", headers=headers, json=body
        )
        if resp.status_code == 401:
            raise ValueError("Invalid channel access token")
        resp.raise_for_status()
        rich_menu_id = resp.json()["richMenuId"]

        # 2. Upload the generated image
        image_bytes = _render_rich_menu_image(labels)
        resp = await client.post(
            f"{_LINE_API_DATA}/v2/bot/richmenu/{rich_menu_id}/content",
            headers={**headers, "Content-Type": "image/png"},
            content=image_bytes,
        )
        resp.raise_for_status()

        # 3. Set as the default rich menu for all users
        resp = await client.post(
            f"{_LINE_API}/v2/bot/user/all/richmenu/{rich_menu_id}", headers=headers
        )
        resp.raise_for_status()

    return rich_menu_id


async def delete_rich_menu(access_token: str, rich_menu_id: str) -> None:
    """Delete a rich menu by id. Ignores 404 (already gone)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{_LINE_API}/v2/bot/richmenu/{rich_menu_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code not in (200, 404):
            resp.raise_for_status()
