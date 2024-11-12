from typing import List, Union, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

# Base Event Model
class BaseEvent(BaseModel):
    event_type: str
    session_id: str
    event_id: str
    timestamp: datetime
    user_id: Optional[str] = None
    client_timestamp: datetime

# Custom Event Model
class CustomEvent(BaseEvent):
    event_type: str = "custom"
    eventName: str
    properties: Optional[dict] = None

# Define the event union type
Event = Union[CustomEvent]  # We'll add other event types later

# Request Models
class BatchAnalyticsRequest(BaseModel):
    events: List[Event]

class RealTimeAnalyticsRequest(BaseModel):
    event_id: str
    timestamp: datetime
    type: str
    data: Dict[str, Any]
    context: Dict[str, Any]

class ExitDataRequest(BaseModel):
    timestamp: str
    timeOnPage: float
    engagementMetrics: Dict[str, Any]
    contentEngagement: Dict[str, Any]
    userBehavior: Dict[str, Any]
    deviceContext: Dict[str, Any]
    navigationContext: Dict[str, Any]

# Response Models
class BatchAnalyticsResponse(BaseModel):
    status: str
    events_processed: int

class RealTimeAnalyticsResponse(BaseModel):
    status: str

class ErrorResponse(BaseModel):
    detail: str