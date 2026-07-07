"""Backward-compatible re-export — all functions now live in app.services.db.*"""
from app.services.db import *  # noqa: F401, F403
from app.services.db import ensure_schema  # noqa: F401
