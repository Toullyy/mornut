import httpx

from app.core.config import settings


async def verify_slip_file(file_bytes: bytes, filename: str, content_type: str) -> dict:
    """Send slip image bytes directly to SlipOK (no pre-upload to Storage required).

    Raises httpx.HTTPStatusError / httpx.RequestError on transport errors.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.slipok_endpoint,
            headers={"x-authorization": settings.slipok_api_key},
            files={"files": (filename, file_bytes, content_type)},
        )
        response.raise_for_status()
        return response.json()


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
