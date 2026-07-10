from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # This tells Pydantic to ignore extra variables and look for .env.local locally
    model_config = SettingsConfigDict(env_file=".env.local", extra='ignore')
    
    supabase_url: str
    supabase_service_role_key: str
    webhook_url: str
    openrouter_api_key: str  # <--- CHANGED THIS TO MATCH YOUR RENDER ENV VAR!

@lru_cache
def get_settings() -> Settings:
    return Settings()
