from linebot.v3.messaging import (
    AsyncApiClient,
    AsyncMessagingApi,
    Configuration,
    PushMessageRequest,
    ReplyMessageRequest,
    TextMessage,
)

from app.core.config import settings


def _get_api() -> AsyncMessagingApi:
    cfg = Configuration(access_token=settings.line_channel_access_token)
    return AsyncMessagingApi(AsyncApiClient(cfg))


async def reply_text(reply_token: str, text: str) -> None:
    """Send a plain-text reply to a LINE event."""
    api = _get_api()
    await api.reply_message(
        ReplyMessageRequest(
            reply_token=reply_token,
            messages=[TextMessage(text=text)],
        )
    )


async def push_text(user_id: str, text: str) -> None:
    """Push a plain-text message to a LINE user."""
    api = _get_api()
    await api.push_message(
        PushMessageRequest(
            to=user_id,
            messages=[TextMessage(text=text)],
        )
    )
