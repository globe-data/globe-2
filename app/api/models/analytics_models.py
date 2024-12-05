from datetime import datetime
from enum import StrEnum
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel

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
        event_type: Type of analytics event from EventTypes enum
    """
    globe_id: UUID
    event_id: UUID
    timestamp: datetime
    session_id: UUID
    client_timestamp: datetime
    event_type: EventTypes

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
    vendor: Optional[str]
    cookies_enabled: bool
    do_not_track: Optional[bool]
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
    memory: Optional[int]
    hardware_concurrency: Optional[int]
    device_memory: Optional[int]

class NetworkInfo(BaseModel):
    """Model containing network connection information.
    
    Attributes:
        connection_type: Type of network connection
        downlink: Effective bandwidth in Mbps
        effective_type: Effective connection type
        rtt: Round trip time in milliseconds
        save_data: Whether data saver is enabled
        anonymize_ip: Whether to anonymize IP address
    """
    connection_type: str
    downlink: float
    effective_type: str
    rtt: float
    save_data: bool
    anonymize_ip: bool

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
    """
    element_path: str
    element_text: str
    target: Dict[str, Any]
    page: Dict[str, Any]
    x_pos: float
    y_pos: float
    href: Optional[str]

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
        time_visible: Time spent in visible state
    """
    visibility_state: VisibilityState

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

class PageViewEvent(Event):
    """Event model for pageview events."""
    event_type: EventTypes = EventTypes.PAGEVIEW
    data: PageViewData

class ClickEvent(Event):
    """Event model for click events."""
    event_type: EventTypes = EventTypes.CLICK
    data: ClickData

class ScrollEvent(Event):
    """Event model for scroll events."""
    event_type: EventTypes = EventTypes.SCROLL
    data: ScrollData

class MediaEvent(Event):
    """Event model for media playback events."""
    event_type: EventTypes = EventTypes.MEDIA
    data: MediaData

class FormEvent(Event):
    """Event model for form interaction events."""
    event_type: EventTypes = EventTypes.FORM
    data: FormData

class ConversionEvent(Event):
    """Event model for conversion events."""
    event_type: EventTypes = EventTypes.CONVERSION
    data: ConversionData

class ErrorEvent(Event):
    """Event model for error events."""
    event_type: EventTypes = EventTypes.ERROR
    data: ErrorData

class PerformanceEvent(Event):
    """Event model for performance metric events."""
    event_type: EventTypes = EventTypes.PERFORMANCE
    data: PerformanceData

class VisibilityEvent(Event):
    """Event model for visibility state events."""
    event_type: EventTypes = EventTypes.VISIBILITY
    data: VisibilityData

class LocationEvent(Event):
    """Event model for location change events."""
    event_type: EventTypes = EventTypes.LOCATION
    data: LocationData

class TabEvent(Event):
    """Event model for tab events."""
    event_type: EventTypes = EventTypes.TAB
    data: TabData

class StorageEvent(Event):
    """Event model for storage operation events."""
    event_type: EventTypes = EventTypes.STORAGE
    data: StorageData

class ResourceEvent(Event):
    """Event model for resource load events."""
    event_type: EventTypes = EventTypes.RESOURCE
    data: ResourceData

class IdleEvent(Event):
    """Event model for idle state events."""
    event_type: EventTypes = EventTypes.IDLE
    data: IdleData

class CustomEvent(Event):
    """Event model for custom events with arbitrary data."""
    event_type: EventTypes = EventTypes.CUSTOM
    name: str
    data: Dict[str, Any]

## REQUEST/RESPONSE MODELS

class AnalyticsBatch(BaseModel):
    """Model representing a batch of analytics events and system information.
    
    Attributes:
        events: List of analytics events
        browser: Browser information
        device: Device information
        network: Network information
    """
    events: List[Event]
    browser: BrowserInfo
    device: DeviceInfo
    network: NetworkInfo

class AnalyticsBatchResponse(BaseModel):
    """Model representing a response to an analytics batch request."""
    success: bool
