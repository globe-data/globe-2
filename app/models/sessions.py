from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import Optional
from .analytics_models import BrowserInfo, DeviceInfo, LocationInfo, NetworkInfo

def get_utc_now():
    """Returns current UTC datetime"""
    return datetime.now(timezone.utc)

class SessionData(BaseModel):
    browser_data: BrowserInfo
    device_data: DeviceInfo
    network_data: NetworkInfo
    location_data: Optional[LocationInfo]

class Session(BaseModel):
    """Session model.

    Attributes:
        globe_id (str): The ID of the globe.
        session_id (str): The ID of the session.
        timestamp (datetime): The timestamp of the session.
    
    The __collection__ class variable specifies which MongoDB collection this model maps to.
    It is used by BaseRepository to determine which collection to perform operations on.
    """
    globe_id: str
    session_id: str
    start_time: datetime = Field(default_factory=get_utc_now)
    end_time: Optional[datetime] = None
    session_data: SessionData
    
    __collection__ = "sessions"  # Maps this model to the "sessions" MongoDB collection

__all__ = ["Session", "SessionData"]