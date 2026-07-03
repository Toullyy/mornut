from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LINE Messaging API
    line_channel_secret: str
    line_channel_access_token: str
    line_notify_token: str

    # SlipOK
    slipok_api_key: str
    slipok_endpoint: str

    # PostgreSQL
    database_url: str  # postgresql://user:password@host:5432/dbname

    # JWT (admin authentication)
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # Clinic (one LINE OA = one clinic for MVP)
    clinic_id: str = ""
    liff_url: str = ""

    # Internal: Cloud Scheduler uses this to authenticate POST /internal/remind
    scheduler_secret: str = ""

    # CORS: comma-separated list of allowed origins for production
    # e.g. ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()  # type: ignore[call-arg]
