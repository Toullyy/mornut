import httpx

from app.core.config import settings


async def verify_slip(image_url: str) -> dict:
    """Call SlipOK API and return the raw verification result.

    Raises httpx.HTTPStatusError on non-2xx responses so callers can
    map the error to an appropriate user-facing message.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            settings.slipok_endpoint,
            headers={"x-authorization": settings.slipok_api_key},
            json={"url": image_url},
        )
        response.raise_for_status()
        return response.json()
