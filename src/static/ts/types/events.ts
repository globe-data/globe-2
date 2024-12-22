/* tslint:disable */
/* eslint-disable */
/**
/* This file was automatically generated from pydantic models by running pydantic2ts.
/* Do not modify it by hand - just update the pydantic models and then re-run the script
*/

/**
 * Enumeration of possible visibility states for a page/element.
 */
export type VisibilityState = "hidden" | "visible" | "prerender" | "unloaded";
/**
 * Enumeration of possible analytics event types.
 */
export enum EventTypes {
  PAGEVIEW = "pageview",
  CLICK = "click",
  SCROLL = "scroll",
  MEDIA = "media",
  FORM = "form",
  CONVERSION = "conversion",
  ERROR = "error",
  PERFORMANCE = "performance",
  VISIBILITY = "visibility",
  LOCATION = "location",
  TAB = "tab",
  STORAGE = "storage",
  RESOURCE = "resource",
  IDLE = "idle",
  CUSTOM = "custom",
}

export type AnalyticsEventUnion =
  | PageViewEvent
  | ClickEvent
  | ScrollEvent
  | MediaEvent
  | FormEvent
  | ConversionEvent
  | ErrorEvent
  | PerformanceEvent
  | VisibilityEvent
  | LocationEvent
  | TabEvent
  | StorageEvent
  | ResourceEvent
  | IdleEvent
  | CustomEvent;

/**
 * Model representing a queued event.
 */
export interface QueuedEvent {
  id: string;
  event_type: EventTypes;
  data: unknown;
  timestamp: number;
}

/**
 * Model representing a batch of analytics events and system information.
 */
export interface AnalyticsBatch {
  events: AnalyticsEventUnion[];
  browser: BrowserInfo;
  device: DeviceInfo;
  network: NetworkInfo;
  [k: string]: unknown;
}
/**
 * Event model for pageview events.
 */
export interface PageViewEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "pageview";
  data: PageViewData;
}
/**
 * Model representing data for a pageview event.
 *
 * Attributes:
 *     url: URL of the pageview
 *     referrer: URL of the page that linked to this page
 *     title: Title of the page
 *     path: Path of the page
 *     viewport: Screen resolution of the viewport
 *     load_time: Time taken to load the page in seconds
 */
export interface PageViewData {
  url: string;
  referrer: string | null;
  title: string;
  path: string;
  viewport: ScreenResolution;
  load_time: number;
}
/**
 * Model representing screen dimensions.
 *
 * Attributes:
 *     width: Screen width in pixels
 *     height: Screen height in pixels
 */
export interface ScreenResolution {
  width: number;
  height: number;
}
/**
 * Event model for click events.
 */
export interface ClickEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "click";
  data: ClickData;
}
/**
 * Model representing data for a click event.
 *
 * Attributes:
 *     element_path: DOM path to clicked element
 *     element_text: Text content of clicked element
 *     target: Additional properties of clicked element
 *     page: Page context where click occurred
 *     x_pos: Horizontal click position
 *     y_pos: Vertical click position
 *     href: Optional link URL if element was a link
 */
export interface ClickData {
  element_path: string;
  element_text: string;
  target: {
    tag: string;
    classes: string[];
    attributes: Record<string, string>;
    dimensions: DOMRect;
    visible: boolean;
  };
  page: {
    url: string;
    title: string;
    viewport: ScreenResolution;
  };
  x_pos: number;
  y_pos: number;
  href: string | null;
  interaction_count: number;
  interaction_types: string[];
  is_programmatic: boolean;
  element_metadata: {
    accessibility: {
      role: string | null;
      label: string | null;
      description: string | null;
    };
    interactivity: {
      is_focusable: boolean;
      is_disabled: boolean;
      tab_index: string | null;
    };
  };
}
/**
 * Event model for scroll events.
 */
export interface ScrollEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "scroll";
  data: ScrollData;
}
/**
 * Model representing data for a scroll event.
 *
 * Attributes:
 *     depth: Current scroll depth in pixels
 *     direction: Direction of scroll (up/down)
 *     max_depth: Maximum scroll depth reached
 *     relative_depth: Scroll depth as percentage of page height
 */
export interface ScrollData {
  depth: number;
  direction: string;
  max_depth: number;
  relative_depth: number;
}
/**
 * Event model for media playback events.
 */
export interface MediaEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "media";
  data: MediaData;
}
/**
 * Model representing data for a media playback event.
 *
 * Attributes:
 *     media_type: Type of media (audio/video)
 *     action: Media action performed (play/pause/etc)
 *     media_url: URL of media resource
 *     playback_time: Current playback position
 *     duration: Total duration of media
 *     title: Optional media title
 */
export interface MediaData {
  media_type: string;
  action: string;
  media_url: string;
  playback_time: number;
  duration: number;
  title: string | null;
}
/**
 * Event model for form interaction events.
 */
export interface FormEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "form";
  data: FormData;
}
/**
 * Model representing data for a form interaction event.
 *
 * Attributes:
 *     form_id: Identifier for the form
 *     action: Form action performed (submit/reset/etc)
 *     fields: List of form field names
 *     success: Whether form submission succeeded
 *     error_message: Optional error message if submission failed
 */
export interface FormData {
  form_id: string;
  action: string;
  fields: string[];
  success: boolean;
  error_message: string | null;
}
/**
 * Event model for conversion events.
 */
export interface ConversionEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "conversion";
  data: ConversionData;
}
/**
 * Model representing data for a conversion event.
 *
 * Attributes:
 *     conversion_type: Type of conversion
 *     value: Monetary value of conversion
 *     currency: Currency code for value
 *     products: Optional list of product identifiers
 */
export interface ConversionData {
  conversion_type: string;
  value: number;
  currency: string;
  products: string[] | null;
}
/**
 * Event model for error events.
 */
export interface ErrorEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "error";
  data: ErrorData;
}
/**
 * Model representing data for an error event.
 *
 * Attributes:
 *     error_type: Type/category of error
 *     message: Error message
 *     stack_trace: Error stack trace
 *     component: Component where error occurred
 */
export interface ErrorData {
  error_type: string;
  message: string;
  stack_trace: string | null;
  component: string;
}
/**
 * Event model for performance metric events.
 */
export interface PerformanceEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "performance";
  data: PerformanceData;
}
/**
 * Model representing data for a performance metric event.
 *
 * Attributes:
 *     metric_name: Name of performance metric
 *     value: Measured value
 *     navigation_type: Type of navigation (navigate/reload/etc)
 *     effective_connection_type: Effective network connection type
 */
export interface PerformanceData {
  metric_name: string;
  value: number;
  navigation_type: string;
  effective_connection_type: string;
}
/**
 * Event model for visibility state events.
 */
export interface VisibilityEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "visibility";
  data: VisibilityData;
}
/**
 * Model representing data for a visibility state change event.
 *
 * Attributes:
 *     visibility_state: New visibility state
 *     time_visible: Time spent in visible state
 */
export interface VisibilityData {
  visibility_state: VisibilityState;
  element_id?: string;
  element_type?: string;
  visibility_ratio: number;
  time_visible?: number;
  viewport_area?: number;
  intersection_rect?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
}
/**
 * Event model for location change events.
 */
export interface LocationEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "location";
  data: LocationData;
}
/**
 * Model representing data for a location/geolocation event.
 *
 * Attributes:
 *     latitude: Geographic latitude coordinate
 *     longitude: Geographic longitude coordinate
 *     accuracy: Accuracy of coordinates in meters
 *     country: Country name
 *     region: Region/state name
 *     city: City name
 *     timezone: Timezone identifier
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  country: string;
  region: string;
  city: string;
  timezone: string;
}
/**
 * Event model for tab events.
 */
export interface TabEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "tab";
  data: TabData;
}
/**
 * Model representing data for a tab event.
 *
 * Attributes:
 *     tab_id: Unique identifier for the tab
 *     tab_title: Title of the tab
 *     tab_url: URL loaded in the tab
 */
export interface TabData {
  tab_id: string;
  tab_title: string;
  tab_url: string;
}
/**
 * Event model for storage operation events.
 */
export interface StorageEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "storage";
  data: StorageData;
}
/**
 * Model representing data for a storage operation event.
 *
 * Attributes:
 *     storage_type: Type of storage (local/session/etc)
 *     key: Storage key accessed
 *     value: Storage value
 */
export interface StorageData {
  storage_type: string;
  key: string;
  value: string;
}
/**
 * Event model for resource load events.
 */
export interface ResourceEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "resource";
  data: ResourceData;
}
/**
 * Model representing data for a resource load event.
 *
 * Attributes:
 *     resource_type: Type of resource loaded
 *     url: Resource URL
 *     duration: Load duration in milliseconds
 *     transfer_size: Size of transferred data
 *     compression_ratio: Optional compression ratio
 *     cache_hit: Whether resource was served from cache
 *     priority: Resource loading priority
 */
export interface ResourceData {
  resource_type: string;
  url: string;
  duration: number;
  transfer_size: number;
  compression_ratio: number | null;
  cache_hit: boolean;
  priority: string;
}
/**
 * Event model for idle state events.
 */
export interface IdleEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "idle";
  data: IdleData;
}
/**
 * Model representing data for an idle state event.
 *
 * Attributes:
 *     idle_time: Duration of idle state
 *     last_interaction: Type of last user interaction
 *     is_idle: Whether user is currently idle
 */
export interface IdleData {
  idle_time: number;
  last_interaction: string;
  is_idle: boolean;
}
/**
 * Event model for custom events with arbitrary data.
 */
export interface CustomEvent {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
  event_type: "custom";
  name: string;
  data: {
    [k: string]: unknown;
  };
}
/**
 * Model containing browser-specific information.
 *
 * Attributes:
 *     user_agent: Browser's user agent string
 *     language: Browser's language setting
 *     platform: Operating system platform
 *     vendor: Browser vendor name
 *     cookies_enabled: Whether cookies are enabled
 *     do_not_track: Browser's DNT setting
 *     time_zone: User's timezone name
 *     time_zone_offset: Timezone offset in minutes
 */
export interface BrowserInfo {
  user_agent: string;
  language: string;
  platform: string;
  vendor: string | null;
  cookies_enabled: boolean;
  do_not_track: boolean | null;
  time_zone: string;
  time_zone_offset: number;
}
/**
 * Model containing device-specific information.
 *
 * Attributes:
 *     screen_resolution: Screen dimensions
 *     color_depth: Number of bits used for colors
 *     pixel_ratio: Device pixel ratio
 *     max_touch_points: Maximum number of touch points supported
 *     memory: Total system memory in GB
 *     hardware_concurrency: Number of logical processors
 *     device_memory: Device memory in GB
 */
export interface DeviceInfo {
  screen_resolution: ScreenResolution;
  color_depth: number;
  pixel_ratio: number;
  max_touch_points: number;
  memory: number | null;
  hardware_concurrency: number | null;
  device_memory: number | null;
}
/**
 * Model containing network connection information.
 *
 * Attributes:
 *     connection_type: Type of network connection
 *     downlink: Effective bandwidth in Mbps
 *     effective_type: Effective connection type
 *     rtt: Round trip time in milliseconds
 *     save_data: Whether data saver is enabled
 *     anonymize_ip: Whether to anonymize IP address
 */
export interface NetworkInfo {
  connection_type: string;
  downlink: number;
  effective_type: string;
  rtt: number;
  save_data: boolean;
  anonymize_ip: boolean;
}
/**
 * Model representing a response to an analytics batch request.
 */
export interface AnalyticsBatchResponse {
  success: boolean;
}
/**
 * Model representing an analytics event.
 */
export interface AnalyticsEvent {
  event_id: string;
  event_type: EventTypes;
  data: {
    [k: string]: unknown;
  };
}
/**
 * Base model for analytics events.
 *
 * Attributes:
 *     globe_id: Unique identifier for the globe instance
 *     event_id: Unique identifier for this specific event
 *     timestamp: Server-side timestamp when event was received
 *     session_id: Unique identifier for the user session
 *     client_timestamp: Browser-side timestamp when event occurred
 */
export interface Event {
  globe_id: string;
  event_id: string;
  timestamp: string;
  session_id: string;
  client_timestamp: string;
}
