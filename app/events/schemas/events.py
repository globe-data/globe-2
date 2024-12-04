from typing import Optional, List, Union
from pydantic import BaseModel
from datetime import datetime
from typing import Literal
from enum import Enum

class EventType(str, Enum):
    PAGEVIEW = "pageview"
    CLICK = "click"
    SCROLL = "scroll"
    MEDIA = "media"
    FORM = "form"
    CONVERSION = "conversion"
    ERROR = "error"
    VISIBILITY = "visibility"
    PERFORMANCE = "performance"
    CUSTOM = "custom"

class BaseEvent(BaseModel):
    globe_id: str
    event_id: str
    timestamp: datetime
    session_id: str
    client_timestamp: datetime
    event_type: str

class PageView(BaseEvent):
    url: str
    referrer: Optional[str]
    title: str
    path: str
    viewport_width: int
    viewport_height: int
    load_time: float

class Click(BaseEvent):
    element_path: str
    element_text: str
    x_pos: int
    y_pos: int
    href: Optional[str]

class Scroll(BaseEvent):
    depth: int
    direction: str
    max_depth: int
    relative_depth: float

class Media(BaseEvent):
    media_type: Literal["video", "audio"]
    action: Literal["play", "pause", "complete"]
    media_url: str
    playback_time: int
    duration: int
    title: Optional[str]

class Form(BaseEvent):
    form_id: str
    action: str
    fields: List[str]
    success: bool
    error_message: Optional[str]

class Conversion(BaseEvent):
    conversion_type: str
    value: float
    currency: str
    products: Optional[List[str]]

class Error(BaseEvent):
    error_type: str
    message: str
    stack_trace: str
    component: str

class Visibility(BaseEvent):
    visibility_state: str

class Performance(BaseEvent):
    metric_name: str
    value: float
    navigation_type: str
    effective_connection_type: str

# Union type for all possible event types
Event = Union[
    PageView,
    Click, 
    Scroll,
    Media,
    Form,
    Conversion,
    Error,
    Performance,
    Visibility
]

# Mapping of event_type strings to event classes
EVENT_TYPE_MAPPING = {
    "pageview": PageView,
    "click": Click,
    "scroll": Scroll,
    "media": Media,
    "form": Form,
    "conversion": Conversion,
    "error": Error,
    "performance": Performance,
    "visibility": Visibility
}