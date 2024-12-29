from datetime import datetime
from enum import StrEnum
from typing import List, Optional, Dict, Any, Union, Annotated, Type, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, ValidationError

from logging import getLogger, StreamHandler
import sys

logger = getLogger(__name__)
logger.setLevel("DEBUG")
handler = StreamHandler(sys.stdout)
handler.setLevel("DEBUG")
logger.addHandler(handler)


## EVENT TYPES
class EventTypes(StrEnum):
    """Enumeration of possible analytics event types."""

    PAGEVIEW = "pageview"
    CLICK = "click"
    SCROLL = "scroll"
    MEDIA = "media"
    FORM = "form"
    CONVERSION = "conversion"
    ERROR = "error"
    PERFORMANCE = "performance"
    VISIBILITY = "visibility"
    LOCATION = "location"
    TAB = "tab"
    STORAGE = "storage"
    RESOURCE = "resource"
    IDLE = "idle"
    CUSTOM = "custom"


class VisibilityState(StrEnum):
    """Enumeration of possible visibility states for a page/element."""

    HIDDEN = "hidden"
    VISIBLE = "visible"
    PRERENDER = "prerender"
    UNLOADED = "unloaded"


## EVENT BASE MODEL
class Event(BaseModel):
    """Base model for analytics events.

    Attributes:
        globe_id: Unique identifier for the globe instance
        event_id: Unique identifier for this specific event
        timestamp: Server-side timestamp when event was received
        session_id: Unique identifier for the user session
        client_timestamp: Browser-side timestamp when event occurred
    """

    globe_id: UUID
    event_id: UUID
    timestamp: datetime
    session_id: UUID
    client_timestamp: datetime
    domain: str
    url: str
    referrer: Optional[str]


## SYSTEM INFORMATION
class BrowserInfo(BaseModel):
    """Model containing browser-specific information.

    Attributes:
        user_agent: Browser's user agent string
        language: Browser's language setting
        platform: Operating system platform
        vendor: Browser vendor name
        cookies_enabled: Whether cookies are enabled
        do_not_track: Browser's DNT setting
        time_zone: User's timezone name
        time_zone_offset: Timezone offset in minutes
    """

    user_agent: str
    language: str
    platform: str
    vendor: str
    cookies_enabled: bool
    do_not_track: bool
    time_zone: str
    time_zone_offset: int


class ScreenResolution(BaseModel):
    """Model representing screen dimensions.

    Attributes:
        width: Screen width in pixels
        height: Screen height in pixels
    """

    width: int
    height: int


class DeviceInfo(BaseModel):
    """Model containing device-specific information.

    Attributes:
        screen_resolution: Screen dimensions
        color_depth: Number of bits used for colors
        pixel_ratio: Device pixel ratio
        max_touch_points: Maximum number of touch points supported
        memory: Total system memory in GB
        hardware_concurrency: Number of logical processors
        device_memory: Device memory in GB
    """

    screen_resolution: ScreenResolution
    color_depth: int
    pixel_ratio: float
    max_touch_points: int
    memory: int
    hardware_concurrency: int
    device_memory: int


class NetworkInfo(BaseModel):
    """Model containing network connection information.

    Attributes:
        connection_type: Type of network connection
        downlink: Effective bandwidth in Mbps
        effective_type: Effective connection type
        rtt: Round trip time in milliseconds
        save_data: Whether data saver is enabled
        anonymize_ip: Whether to anonymize IP address
        ip_address: IP address
    """

    connection_type: str
    downlink: float
    effective_type: str
    rtt: int
    save_data: bool
    anonymize_ip: bool
    ip_address: Optional[str] = None

class LocationInfo(BaseModel):
    """Model containing location information.

    Attributes:
        latitude: Geographic latitude coordinate
        longitude: Geographic longitude coordinate
        accuracy: Accuracy of coordinates in meters
        country: Country name
        region: Region/state name
        city: City name
        timezone: Timezone identifier
    """
    latitude: float
    longitude: float
    accuracy: float
    country: str
    region: str
    city: str
    timezone: str


## ANALYTICS EVENT DATA


class PageViewData(BaseModel):
    """Model representing data for a pageview event.

    Attributes:
        url: URL of the pageview
        referrer: URL of the page that linked to this page
        title: Title of the page
        path: Path of the page
        viewport: Screen resolution of the viewport
        load_time: Time taken to load the page in seconds
    """

    url: str
    referrer: Optional[str]
    title: str
    path: str
    viewport: ScreenResolution
    load_time: float


class ClickData(BaseModel):
    """Model representing data for a click event.

    Attributes:
        element_path: DOM path to clicked element
        element_text: Text content of clicked element
        target: Additional properties of clicked element
        page: Page context where click occurred
        x_pos: Horizontal click position
        y_pos: Vertical click position
        href: Optional link URL if element was a link
        interaction_count: Number of times the element has been interacted with
        interaction_types: List of interaction types
        is_programmatic: Whether the click was programmatic
        element_metadata: Additional metadata about the element
    """

    element_path: str
    element_text: str
    target: Dict[str, Any] = Field(
        ...,
        description="Additional properties of clicked element",
        example={
            "tag": "button",
            "classes": ["btn", "btn-primary"],
            "attributes": {"id": "submit-btn"},
            "dimensions": {"x": 0, "y": 0, "width": 100, "height": 30},
            "visible": True,
        },
    )
    page: Dict[str, Any] = Field(
        ...,
        description="Page context where click occurred",
        example={
            "url": "https://example.com",
            "title": "Example Page",
            "viewport": {"width": 1920, "height": 1080},
        },
    )
    x_pos: float
    y_pos: float
    href: Optional[str]
    interaction_count: int
    interaction_types: List[str]
    is_programmatic: bool
    element_metadata: Dict[str, Any] = Field(
        ...,
        description="Additional metadata about the element",
        example={
            "accessibility": {
                "role": "button",
                "label": "Submit",
                "description": "Submit form",
            },
            "interactivity": {
                "is_focusable": True,
                "is_disabled": False,
                "tab_index": "0",
            },
        },
    )


class ScrollData(BaseModel):
    """Model representing data for a scroll event.

    Attributes:
        depth: Current scroll depth in pixels
        direction: Direction of scroll (up/down)
        max_depth: Maximum scroll depth reached
        relative_depth: Scroll depth as percentage of page height
    """

    depth: float
    direction: str
    max_depth: float
    relative_depth: float


class MediaData(BaseModel):
    """Model representing data for a media playback event.

    Attributes:
        media_type: Type of media (audio/video)
        action: Media action performed (play/pause/etc)
        media_url: URL of media resource
        playback_time: Current playback position
        duration: Total duration of media
        title: Optional media title
    """

    media_type: str
    action: str
    media_url: str
    playback_time: float
    duration: float
    title: Optional[str]


class FormData(BaseModel):
    """Model representing data for a form interaction event.

    Attributes:
        form_id: Identifier for the form
        action: Form action performed (submit/reset/etc)
        fields: List of form field names
        success: Whether form submission succeeded
        error_message: Optional error message if submission failed
    """

    form_id: str
    action: str
    fields: List[str]
    success: bool
    error_message: Optional[str]


class ConversionData(BaseModel):
    """Model representing data for a conversion event.

    Attributes:
        conversion_type: Type of conversion
        value: Monetary value of conversion
        currency: Currency code for value
        products: Optional list of product identifiers
    """

    conversion_type: str
    value: float
    currency: str
    products: Optional[List[str]]


class ErrorData(BaseModel):
    """Model representing data for an error event.

    Attributes:
        error_type: Type/category of error
        message: Error message
        stack_trace: Error stack trace
        component: Component where error occurred
    """

    error_type: str
    message: str
    stack_trace: str
    component: str


class PerformanceData(BaseModel):
    """Model representing data for a performance metric event.

    Attributes:
        metric_name: Name of performance metric
        value: Measured value
        navigation_type: Type of navigation (navigate/reload/etc)
        effective_connection_type: Effective network connection type
    """

    metric_name: str
    value: float
    navigation_type: str
    effective_connection_type: str


class VisibilityData(BaseModel):
    """Model representing data for a visibility state change event.

    Attributes:
        visibility_state: New visibility state
        element_id: ID of the element that changed visibility
        element_type: Type of the element that changed visibility
        visibility_ratio: Ratio of visible area to total area of the element
        time_visible: Time spent in visible state
        viewport_area: Area of the viewport in pixels
        intersection_rect: Intersection rectangle coordinates
    """

    visibility_state: VisibilityState
    element_id: Optional[str] = None
    element_type: Optional[str] = None
    visibility_ratio: float
    time_visible: Optional[float] = None
    viewport_area: Optional[float] = None
    intersection_rect: Optional[Dict[str, float]] = Field(
        None,
        description="Intersection rectangle coordinates",
        example={
            "top": 0,
            "left": 0,
            "bottom": 100,
            "right": 100,
        },
    )


class LocationData(BaseModel):
    """Model representing data for a location/geolocation event.

    Attributes:
        latitude: Geographic latitude coordinate
        longitude: Geographic longitude coordinate
        accuracy: Accuracy of coordinates in meters
        country: Country name
        region: Region/state name
        city: City name
        timezone: Timezone identifier
    """

    latitude: float
    longitude: float
    accuracy: float
    country: str
    region: str
    city: str
    timezone: str


class TabData(BaseModel):
    """Model representing data for a tab event.

    Attributes:
        tab_id: Unique identifier for the tab
        tab_title: Title of the tab
        tab_url: URL loaded in the tab
    """

    tab_id: str
    tab_title: str
    tab_url: str


class StorageData(BaseModel):
    """Model representing data for a storage operation event.

    Attributes:
        storage_type: Type of storage (local/session/etc)
        key: Storage key accessed
        value: Storage value
    """

    storage_type: str
    key: str
    value: str


class ResourceData(BaseModel):
    """Model representing data for a resource load event.

    Attributes:
        resource_type: Type of resource loaded
        url: Resource URL
        duration: Load duration in milliseconds
        transfer_size: Size of transferred data
        compression_ratio: Optional compression ratio
        cache_hit: Whether resource was served from cache
        priority: Resource loading priority
    """

    resource_type: str
    url: str
    duration: float
    transfer_size: float
    compression_ratio: Optional[float]
    cache_hit: Optional[bool]
    priority: str


class IdleData(BaseModel):
    """Model representing data for an idle state event.

    Attributes:
        idle_time: Duration of idle state
        last_interaction: Type of last user interaction
        is_idle: Whether user is currently idle
    """

    idle_time: float
    last_interaction: str
    is_idle: bool


## ANALYTICS EVENTS

EVENT_MODELS: Dict[EventTypes, Type[Event]] = {}


def register_event(event_type: EventTypes):
    """Decorator to register event models."""

    def wrapper(cls):
        EVENT_MODELS[event_type] = cls
        return cls

    return wrapper


@register_event(EventTypes.PAGEVIEW)
class PageViewEvent(Event):
    """Event model for pageview events."""

    event_type: Literal[EventTypes.PAGEVIEW]
    data: PageViewData


@register_event(EventTypes.CLICK)
class ClickEvent(Event):
    """Event model for click events."""

    event_type: Literal[EventTypes.CLICK]
    data: ClickData


@register_event(EventTypes.SCROLL)
class ScrollEvent(Event):
    """Event model for scroll events."""

    event_type: Literal[EventTypes.SCROLL]
    data: ScrollData


@register_event(EventTypes.MEDIA)
class MediaEvent(Event):
    """Event model for media playback events."""

    event_type: Literal[EventTypes.MEDIA]
    data: MediaData


@register_event(EventTypes.FORM)
class FormEvent(Event):
    """Event model for form interaction events."""

    event_type: Literal[EventTypes.FORM]
    data: FormData


@register_event(EventTypes.CONVERSION)
class ConversionEvent(Event):
    """Event model for conversion events."""

    event_type: Literal[EventTypes.CONVERSION]
    data: ConversionData


@register_event(EventTypes.ERROR)
class ErrorEvent(Event):
    """Event model for error events."""

    event_type: Literal[EventTypes.ERROR]
    data: ErrorData


@register_event(EventTypes.PERFORMANCE)
class PerformanceEvent(Event):
    """Event model for performance metric events."""

    event_type: Literal[EventTypes.PERFORMANCE]
    data: PerformanceData


@register_event(EventTypes.VISIBILITY)
class VisibilityEvent(Event):
    """Event model for visibility state events."""

    event_type: Literal[EventTypes.VISIBILITY]
    data: VisibilityData


@register_event(EventTypes.LOCATION)
class LocationEvent(Event):
    """Event model for location change events."""

    event_type: Literal[EventTypes.LOCATION]
    data: LocationData


@register_event(EventTypes.TAB)
class TabEvent(Event):
    """Event model for tab events."""

    event_type: Literal[EventTypes.TAB]
    data: TabData


@register_event(EventTypes.STORAGE)
class StorageEvent(Event):
    """Event model for storage operation events."""

    event_type: Literal[EventTypes.STORAGE]
    data: StorageData


@register_event(EventTypes.RESOURCE)
class ResourceEvent(Event):
    """Event model for resource load events."""

    event_type: Literal[EventTypes.RESOURCE]
    data: ResourceData


@register_event(EventTypes.IDLE)
class IdleEvent(Event):
    """Event model for idle state events."""

    event_type: Literal[EventTypes.IDLE]
    data: IdleData


class CustomEvent(Event):
    """Event model for custom events with arbitrary data."""

    event_type: Literal[EventTypes.CUSTOM]
    name: str
    data: Dict[str, Any]


## REQUEST/RESPONSE MODELS


class AnalyticsBatch(BaseModel):
    """Model representing a batch of analytics events and system information."""

    events: List[
        Annotated[
            Union[
                PageViewEvent,
                ClickEvent,
                ScrollEvent,
                MediaEvent,
                FormEvent,
                ConversionEvent,
                ErrorEvent,
                PerformanceEvent,
                VisibilityEvent,
                LocationEvent,
                TabEvent,
                StorageEvent,
                ResourceEvent,
                IdleEvent,
                CustomEvent,
            ],
            Field(discriminator="event_type"),
        ]
    ] = Field(default_factory=list)

    class Config:
        validate_assignment = True
        extra = "allow"  # Allow extra fields
        validate_default = False  # Don't validate default values

    @field_validator("events", mode="before")
    def validate_events(cls, events):
        validated_events = []
        for event in events:
            if not isinstance(event, dict):
                continue
                
            event_type = event.get("event_type")
            if not event_type or event_type not in EVENT_MODELS:
                continue
                
            model = EVENT_MODELS[EventTypes(event_type)]
            try:
                validated_event = model(**event)
                validated_events.append(validated_event)
            except ValidationError as e:
                logger.error(f"Validation error: {e.errors()}\nEvent data: {event}")
                continue
                
        return validated_events


class AnalyticsEvent(BaseModel):
    """Model representing an analytics event."""

    event_id: UUID
    event_type: EventTypes
    data: Dict[str, Any]


class AnalyticsBatchResponse(BaseModel):
    """Model representing a response to an analytics batch request."""

    success: bool
    events_stored: Optional[List[UUID]]


# Add this mapping at the module level
EVENT_TYPE_TO_MODEL = {
    EventTypes.PAGEVIEW: PageViewData,
    EventTypes.CLICK: ClickData,
    EventTypes.SCROLL: ScrollData,
    EventTypes.MEDIA: MediaData,
    EventTypes.FORM: FormData,
    EventTypes.CONVERSION: ConversionData,
    EventTypes.ERROR: ErrorData,
    EventTypes.PERFORMANCE: PerformanceData,
    EventTypes.VISIBILITY: VisibilityData,
    EventTypes.LOCATION: LocationData,
    EventTypes.TAB: TabData,
    EventTypes.STORAGE: StorageData,
    EventTypes.RESOURCE: ResourceData,
    EventTypes.IDLE: IdleData,
}

__all__ = [
    name
    for name, obj in globals().items()
    if isinstance(obj, type) and issubclass(obj, BaseModel) and obj != BaseModel
]
