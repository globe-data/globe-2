from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Globe Data"
    version: str = "0.1.0"
    debug: bool = True
    log_level: str = "DEBUG"
    environment: str = "development"
    secret_key: str = "test-key"

    # Use localhost when running locally, mongodb when in Docker
    MONGO_HOST: str = "localhost"
    MONGO_PORT: int = 27017
    MONGO_USER: str = "root"
    MONGO_PASSWORD: str = "example"
    MONGO_DB_NAME: str = "globe_data"

    @property
    def MONGO_URI(self) -> str:
        return f"mongodb://{self.MONGO_USER}:{self.MONGO_PASSWORD}@{self.MONGO_HOST}:{self.MONGO_PORT}/"

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

