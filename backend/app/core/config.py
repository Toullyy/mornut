from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    line_channel_secret: str
    line_channel_access_token: str
    line_notify_token: str
    slipok_api_key: str
    slipok_endpoint: str
    firebase_project_id: str
    google_application_credentials: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()  # type: ignore[call-arg]
