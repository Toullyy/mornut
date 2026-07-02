import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client

from app.core.config import settings

_db: Client | None = None


def get_db() -> Client:
    """Return a singleton Firestore client.

    Cloud Run: uses Application Default Credentials (no key file needed).
    Local dev:  set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
    """
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        _db = firestore.client()
    return _db
