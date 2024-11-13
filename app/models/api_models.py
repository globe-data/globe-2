from typing import List, Union, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

# Event Type Enum
class EventType(str, Enum):
    PAGEVIEW = "pageview"
    CLICK = "click"
    SCROLL = "scroll"
    MEDIA = "media"
    FORM = "form"
    CONVERSION = "conversion"
    ERROR = "error"
    PERFORMANCE = "performance"
    CUSTOM = "custom"

# Base Event Model
class BaseEvent(BaseModel):
    event_id: str
    timestamp: datetime
    session_id: str
    user_id: str
    client_timestamp: datetime

# Event-specific Models
class PageViewEvent(BaseEvent):
    event_type: Literal[EventType.PAGEVIEW]
    data: dict = Field(..., example={
        "url": str,
        "referrer": str,
        "title": str,
        "path": str,
        "viewport": {"width": int, "height": int},
        "load_time": float
    })

class ClickEvent(BaseEvent):
    event_type: Literal[EventType.CLICK]
    data: dict = Field(..., example={
        "element_path": str,
        "element_text": str,
        "x_pos": int,
        "y_pos": int,
        "href": Optional[str]
    })

class ScrollEvent(BaseEvent):
    event_type: Literal[EventType.SCROLL]
    data: dict = Field(..., example={
        "depth": int,
        "direction": str,
        "max_depth": int,
        "relative_depth": float
    })

class MediaEvent(BaseEvent):
    event_type: Literal[EventType.MEDIA]
    data: dict = Field(..., example={
        "media_type": str,
        "action": str,
        "media_url": str,
        "playback_time": int,
        "duration": int,
        "title": str
    })

class FormEvent(BaseEvent):
    event_type: Literal[EventType.FORM]
    data: dict = Field(..., example={
        "form_id": str,
        "action": str,
        "fields": List[str],
        "success": bool,
        "error_message": Optional[str]
    })

class ConversionEvent(BaseEvent):
    event_type: Literal[EventType.CONVERSION]
    data: dict = Field(..., example={
        "conversion_type": str,
        "value": float,
        "currency": str,
        "products": Optional[List[str]]
    })

class ErrorEvent(BaseEvent):
    event_type: Literal[EventType.ERROR]
    data: dict = Field(..., example={
        "error_type": str,
        "message": str,
        "stack_trace": str,
        "component": str
    })

class PerformanceEvent(BaseEvent):
    event_type: Literal[EventType.PERFORMANCE]
    data: dict = Field(..., example={
        "metric_name": str,
        "value": float,
        "navigation_type": str,
        "effective_connection_type": str
    })

class CustomEvent(BaseEvent):
    event_type: Literal[EventType.CUSTOM]
    name: str
    data: dict = Field(..., example={
        "properties": Optional[Dict[str, Any]]
    })

# Define the event union type
Event = Union[
    PageViewEvent,
    ClickEvent,
    ScrollEvent,
    MediaEvent,
    FormEvent,
    ConversionEvent,
    ErrorEvent,
    PerformanceEvent,
    CustomEvent
]

# Request Models
class BatchAnalyticsRequest(BaseModel):
    events: List[Dict[str, Any]]  # Accept raw dictionaries first

    def model_post_init(self, *args, **kwargs):
        # Convert raw dictionaries to proper event types
        processed_events = []
        for event in self.events:
            event_type = event.get('event_type')
            if not event_type:
                continue
                
            # Restructure event data
            base_data = {
                'event_id': event['event_id'],
                'timestamp': event['timestamp'],
                'session_id': event['session_id'],
                'user_id': event['user_id'],
                'client_timestamp': event['client_timestamp'],
                'event_type': event['event_type'],
                'data': event.get('data', {})
            }
            
            # Create appropriate event object based on type
            event_class = {
                'pageview': PageViewEvent,
                'click': ClickEvent,
                'scroll': ScrollEvent,
                'media': MediaEvent,
                'form': FormEvent,
                'conversion': ConversionEvent,
                'error': ErrorEvent,
                'performance': PerformanceEvent,
                'custom': CustomEvent
            }.get(event_type)
            
            if event_class:
                processed_events.append(event_class(**base_data))
                
        self.events = processed_events

class AnalyticsResponse(BaseModel):
    status: str
    events_processed: int
    errors: Optional[List[Dict[str, Any]]] = None

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
