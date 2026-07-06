import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import admin, booking, clinics, doctors, internal, quota, slip, webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables not present in an already-initialised volume exist (e.g. line_settings).
    try:
        from app.services.database import ensure_schema
        await asyncio.to_thread(ensure_schema)
    except Exception as e:
        print(f"[STARTUP] ensure_schema failed (non-fatal): {e}")

    if settings.debug_mode:
        try:
            from app.services.dev_seed import reseed_today
            result = await asyncio.to_thread(reseed_today)
            print(f"[DEV] Auto-seeded: {result}")
        except Exception as e:
            print(f"[DEV] Auto-seed failed (non-fatal): {e}")
    yield


app = FastAPI(title="MorNut API", version="1.0.0", lifespan=lifespan)

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
app.include_router(doctors.router, prefix="/doctors", tags=["doctors"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}
