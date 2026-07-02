import asyncio
from datetime import datetime, timezone

from firebase_admin import storage as fb_storage

from app.services.firestore import get_db  # ensures firebase_admin is initialized


async def upload_slip(booking_id: str, file_bytes: bytes, content_type: str) -> str:
    """Upload slip image bytes to Firebase Storage.

    Returns the gs:// storage path (not a public URL — only the backend accesses it).
    """
    get_db()  # guarantee firebase_admin.initialize_app has run
    ext = (content_type.split("/")[-1] or "jpg").replace("jpeg", "jpg")
    ts = int(datetime.now(timezone.utc).timestamp())
    path = f"slips/{booking_id}/{ts}.{ext}"
    await asyncio.to_thread(_upload_sync, path, file_bytes, content_type)
    return path


def _upload_sync(path: str, data: bytes, content_type: str) -> None:
    blob = fb_storage.bucket().blob(path)
    blob.upload_from_string(data, content_type=content_type)
