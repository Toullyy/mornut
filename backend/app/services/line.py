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
