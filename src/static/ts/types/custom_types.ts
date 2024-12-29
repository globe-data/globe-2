import {
  ClickEvent,
  ConversionEvent,
  ScrollEvent,
  MediaEvent,
  EventTypes,
  VisibilityEvent,
  IdleEvent,
  LocationEvent,
  ResourceEvent,
  TabEvent,
  ErrorEvent,
  PageViewEvent,
  PerformanceEvent,
  FormEvent,
  CustomEvent as AnalyticsCustomEvent,
  StorageEvent as StorageAnalyticsEvent,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
} from "./pydantic_types";

/**
 * Model representing a queued event.
 */
export interface QueuedEvent {
  id: string;
  event_type: EventTypes;
  data: unknown;
  timestamp: number;
}

export type AnalyticsEventUnion =
  | ClickEvent
  | ScrollEvent
  | MediaEvent
  | ConversionEvent
  | ErrorEvent
  | VisibilityEvent
  | ResourceEvent
  | IdleEvent
  | TabEvent
  | LocationEvent
  | StorageAnalyticsEvent
  | PageViewEvent
  | PerformanceEvent
  | FormEvent
  | AnalyticsCustomEvent;

export const EventTypesEnum = {
  pageview: "pageview" as const,
  click: "click" as const,
  scroll: "scroll" as const,
  media: "media" as const,
  form: "form" as const,
  conversion: "conversion" as const,
  error: "error" as const,
  performance: "performance" as const,
  visibility: "visibility" as const,
  location: "location" as const,
  tab: "tab" as const,
  storage: "storage" as const,
  resource: "resource" as const,
  idle: "idle" as const,
  custom: "custom" as const,
};

interface LocationInfo {
  latitude: number;
  longitude: number;
}

interface WorkerMessage {
  type: "PROCESS_BATCH" | "RETRY_FAILED" | "END_SESSION" | "START_SESSION";
  session?: {
    globe_id: string;
    session_id: string;
    session_data: {
      browser_data: BrowserInfo;
      device_data: DeviceInfo;
      network_data: NetworkInfo;
      location_data?: LocationInfo | null;
    };
  };
  events?: AnalyticsEventUnion[];
  timestamp?: number;
}
