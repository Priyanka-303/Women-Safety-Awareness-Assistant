from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    webhook_url: str
    google_api_key: str

    class Config:
        env_file = ".env.local"
        env_file_encoding = 'utf-8'
        extra = 'ignore'

@lru_cache
def get_settings() -> Settings:
    return Settings()
