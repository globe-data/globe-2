from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Globe Data"
    version: str = "0.1.0"
    debug: bool = True
    log_level: str = "DEBUG"

