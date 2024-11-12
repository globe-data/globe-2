from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Globe Data"
    VERSION: str = "1.0.0"
    
    # Security
    SECRET_KEY: str = "dev-secret-key-not-for-production"  # Default for development
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",  # Frontend
        "http://127.0.0.1:3000",  # Frontend alternative
        "http://localhost:8000",  # Backend
        "http://127.0.0.1:8000"   # Backend alternative
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
        extra = "forbid"  # Prevent extra fields


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()