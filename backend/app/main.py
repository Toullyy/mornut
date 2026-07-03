from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import admin, booking, clinics, internal, quota, slip, webhook

app = FastAPI(title="MorNut API", version="1.0.0")

_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])
app.include_router(clinics.router, prefix="/clinics", tags=["clinics"])
app.include_router(booking.router, prefix="/bookings", tags=["bookings"])
app.include_router(slip.router, prefix="/slips", tags=["slips"])
app.include_router(quota.router, prefix="/quotas", tags=["quotas"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}
