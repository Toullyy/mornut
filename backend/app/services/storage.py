"""Local file storage for slip images (replaces Firebase Storage)."""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "slips"


async def upload_slip(booking_id: str, file_bytes: bytes, content_type: str) -> str:
    """Save slip image to local disk.

    Returns the relative storage path stored in the database.
    """
    ext = (content_type.split("/")[-1] or "jpg").replace("jpeg", "jpg")
    ts = int(datetime.now(timezone.utc).timestamp())
    relative_path = f"{booking_id}/{ts}.{ext}"
    await asyncio.to_thread(_save_file, relative_path, file_bytes)
    return relative_path


def _save_file(relative_path: str, data: bytes) -> None:
    dest = UPLOAD_DIR / relative_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
