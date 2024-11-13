from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache
from dotenv import load_dotenv
import os
import logging
from pydantic import field_validator
from typing import Union, Optional

load_dotenv()

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Globe Data"
    VERSION: str = "1.0.0"
    STORAGE_TYPE: str = "supabase"  # Must be either "supabase" or "timescale"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-secret-key")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Supabase Settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    @field_validator("SUPABASE_URL")
    def validate_supabase_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("SUPABASE_URL must start with http:// or https://")
        return v.rstrip('/')  # Remove trailing slash if present
    
    @field_validator("SUPABASE_KEY")
    def validate_supabase_key(cls, v):
        if not v:
            raise ValueError("SUPABASE_KEY cannot be empty")
        return v
    
    SUPABASE_PASSWORD: str = os.getenv("SUPABASE_PASSWORD", "")
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    ALLOWED_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    ALLOWED_HEADERS: List[str] = ["*"]
    ALLOW_CREDENTIALS: bool = True

    @field_validator("ALLOWED_ORIGINS", mode='before')
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v:
                return []
            if not v.startswith("["):
                return [i.strip() for i in v.split(",")]
            return v
        return v

    # Supabase Settings
    # SUPABASE_URL: str
    # SUPABASE_KEY: str
    
    # API Documentation
    DOCS_URL: Optional[str] = "/docs"
    REDOC_URL: Optional[str] = "/redoc"
    OPENAPI_URL: Optional[str] = "/openapi.json"
    
    # Development Settings
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Kafka Settings
    KAFKA_SERVERS: str = "localhost:9092"
    KAFKA_LOGGING_ENABLED: bool = False  # Set to True in production

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()