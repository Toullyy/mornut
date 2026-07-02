from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LINE Messaging API
    line_channel_secret: str
    line_channel_access_token: str
    line_notify_token: str

    # SlipOK
    slipok_api_key: str
    slipok_endpoint: str

    # Firebase
    firebase_project_id: str
    google_application_credentials: str = ""

    # Internal: Cloud Scheduler uses this to authenticate POST /internal/remind
    # Leave empty in dev (no auth check). Set to a secure random string in prod.
    scheduler_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()  # type: ignore[call-arg]
