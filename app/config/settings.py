from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Globe Data"
    version: str = "0.1.0"
    debug: bool = True
    log_level: str = "DEBUG"
    environment: str = "development"
    secret_key: str = "test-key"

    # Allow all origins in development, restrict in production
    allowed_origins: list[str] = ["*"]

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # MongoDB settings - these will be overridden by Modal's environment variables
    MONGO_HOST: str = "localhost"
    MONGO_PORT: int = 27017
    MONGO_USER: str = "root"
    MONGO_PASSWORD: str = "example"
    MONGO_DB_NAME: str = "globe_data"

    @property
    def MONGO_URI(self) -> str:
        # In production, this will be overridden by Modal's MongoDB connection string
        if self.environment == "production":
            return self.mongodb_url  # Modal will provide this
        return f"mongodb://{self.MONGO_USER}:{self.MONGO_PASSWORD}@{self.MONGO_HOST}:{self.MONGO_PORT}/"

    # Security headers - Modal handles SSL/TLS
    security_headers: dict = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    }

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

