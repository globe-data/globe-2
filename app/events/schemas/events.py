from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from uuid import uuid4

# Base event that all others inherit from
class BaseEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: str
    user_id: Optional[str] = None
    client_timestamp: Optional[datetime] = None

# User interaction events
class PageViewEvent(BaseEvent):
    event_type: str = "pageview"
    url: str
    referrer: Optional[str] = None
    title: str
    path: str
    viewport: Dict[str, int]  # {width: X, height: Y}
    load_time: Optional[float] = None

class ClickEvent(BaseEvent):
    event_type: str = "click"
    element_path: str
    element_text: Optional[str] = None
    x_pos: int
    y_pos: int
    href: Optional[str] = None

class ScrollEvent(BaseEvent):
    event_type: str = "scroll"
    depth: int
    direction: str  # "up" or "down"
    max_depth: int
    relative_depth: float  # percentage of page

class MediaEvent(BaseEvent):
    event_type: str = "media"
    media_type: str  # "video" or "audio"
    action: str  # "play", "pause", "complete"
    media_url: str
    current_time: float
    duration: float
    title: Optional[str] = None

class FormEvent(BaseEvent):
    event_type: str = "form"
    form_id: str
    action: str  # "submit", "abandon"
    fields: List[str]  # List of field names (not values for privacy)
    success: bool
    error_message: Optional[str] = None

# Conversion/Business events
class ConversionEvent(BaseEvent):
    event_type: str = "conversion"
    conversion_type: str
    value: float
    currency: str = "USD"
    products: Optional[List[str]] = None

# Error/Performance events
class ErrorEvent(BaseEvent):
    event_type: str = "error"
    error_type: str
    message: str
    stack_trace: Optional[str] = None
    component: Optional[str] = None

class PerformanceEvent(BaseEvent):
    event_type: str = "performance"
    metric_name: str
    value: float
    navigation_type: Optional[str] = None
    effective_connection_type: Optional[str] = None

# Their corresponding Avro schemas
AVRO_SCHEMAS = {
    "pageview": {
        "type": "record",
        "name": "PageView",
        "namespace": "com.yourcompany.analytics",
        "fields": [
            {"name": "event_id", "type": "string"},
            {"name": "timestamp", "type": "long", "logicalType": "timestamp-millis"},
            {"name": "session_id", "type": "string"},
            {"name": "user_id", "type": ["null", "string"]},
            {"name": "client_timestamp", "type": ["null", "long"], "logicalType": "timestamp-millis"},
            {"name": "url", "type": "string"},
            {"name": "referrer", "type": ["null", "string"]},
            {"name": "title", "type": "string"},
            {"name": "path", "type": "string"},
            {"name": "viewport", "type": {
                "type": "record",
                "name": "Viewport",
                "fields": [
                    {"name": "width", "type": "int"},
                    {"name": "height", "type": "int"}
                ]
            }},
            {"name": "load_time", "type": ["null", "double"]}
        ]
    }
    # Add other event schemas as needed
}

# Mapping between Pydantic models and Avro schemas
EVENT_TYPE_MAPPING = {
    "pageview": (PageViewEvent, AVRO_SCHEMAS["pageview"]),
    "click": (ClickEvent, AVRO_SCHEMAS.get("click")),
    "scroll": (ScrollEvent, AVRO_SCHEMAS.get("scroll")),
    "media": (MediaEvent, AVRO_SCHEMAS.get("media")),
    "form": (FormEvent, AVRO_SCHEMAS.get("form")),
    "conversion": (ConversionEvent, AVRO_SCHEMAS.get("conversion")),
    "error": (ErrorEvent, AVRO_SCHEMAS.get("error")),
    "performance": (PerformanceEvent, AVRO_SCHEMAS.get("performance"))
}