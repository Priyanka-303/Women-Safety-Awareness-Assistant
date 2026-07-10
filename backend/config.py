from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra='ignore')
    
    supabase_url: str
    supabase_service_role_key: str
    webhook_url: str
    google_api_key: str

@lru_cache
def get_settings() -> Settings:
    return Settings()
