import { z } from "zod";

// Base event type that all others extend from
const BaseEvent = z.object({
  globe_id: z.string(),
  event_id: z.string(),
  timestamp: z.date(),
  session_id: z.string(),
  client_timestamp: z.date(),
  event_type: z.string(),
});

const BrowserInfo = z.object({
  user_agent: z.string(),
  language: z.string(),
  platform: z.string(),
  vendor: z.string(),
  cookies_enabled: z.boolean(),
  do_not_track: z.boolean().optional(),
  time_zone: z.string(),
  time_zone_offset: z.number(),
});

const NetworkInfo = z.object({
  connection_type: z.string(),
  downlink: z.number(),
  effective_type: z.string(),
  rtt: z.number(),
  save_data: z.boolean(),
  anonymize_ip: z.boolean(),
});

const DeviceInfo = z.object({
  screen_resolution: z.object({
    width: z.number(),
    height: z.number(),
  }),
  color_depth: z.number(),
  pixel_ratio: z.number(),
  max_touch_points: z.number(),
  memory: z.number().optional(),
  hardware_concurrency: z.number().optional(),
  device_memory: z.number().optional(),
});

const PageViewEvent = BaseEvent.extend({
  event_type: z.literal("pageview"),
  data: z.object({
    url: z.string(),
    referrer: z.string().optional(),
    title: z.string(),
    path: z.string(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
    load_time: z.number(),
  }),
});

const ClickEvent = BaseEvent.extend({
  event_type: z.literal("click"),
  data: z.object({
    element_path: z.string(),
    element_text: z.string(),
    target: z.record(z.unknown()),
    page: z.record(z.unknown()),
    x_pos: z.number(),
    y_pos: z.number(),
    href: z.string().optional(),
  }),
});

const ScrollEvent = BaseEvent.extend({
  event_type: z.literal("scroll"),
  data: z.object({
    depth: z.number(),
    direction: z.string(),
    max_depth: z.number(),
    relative_depth: z.number(),
  }),
});

const MediaEvent = BaseEvent.extend({
  event_type: z.literal("media"),
  data: z.object({
    media_type: z.enum(["video", "audio"]),
    action: z.string(),
    media_url: z.string(),
    playback_time: z.number(),
    duration: z.number(),
    title: z.string().optional(),
  }),
});

const FormEvent = BaseEvent.extend({
  event_type: z.literal("form"),
  data: z.object({
    form_id: z.string(),
    action: z.string(),
    fields: z.array(z.string()),
    success: z.boolean(),
    error_message: z.string().optional(),
  }),
});

const ConversionEvent = BaseEvent.extend({
  event_type: z.literal("conversion"),
  data: z.object({
    conversion_type: z.string(),
    value: z.number(),
    currency: z.string(),
    products: z.array(z.string()).optional(),
  }),
});

const ErrorEvent = BaseEvent.extend({
  event_type: z.literal("error"),
  data: z.object({
    error_type: z.string(),
    message: z.string(),
    stack_trace: z.string(),
    component: z.string(),
  }),
});

const PerformanceEvent = BaseEvent.extend({
  event_type: z.literal("performance"),
  data: z.object({
    metric_name: z.string(),
    value: z.number(),
    navigation_type: z.string(),
    effective_connection_type: z.string(),
  }),
});

export enum VisibilityState {
  HIDDEN = "hidden",
  VISIBLE = "visible",
  PRERENDER = "prerender",
  UNLOADED = "unloaded",
}

const VisibilityEvent = BaseEvent.extend({
  event_type: z.literal("visibility"),
  data: z.object({
    visibility_state: z.nativeEnum(VisibilityState),
  }),
});

const CustomEvent = BaseEvent.extend({
  event_type: z.literal("custom"),
  name: z.string(),
  data: z.record(z.unknown()),
});

const LocationEvent = BaseEvent.extend({
  event_type: z.literal("location"),
  data: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    accuracy: z.number().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    timezone: z.string(),
  }),
});

const TabEvent = BaseEvent.extend({
  event_type: z.literal("tab"),
  data: z.object({
    action: z.enum(["open", "close", "focus", "blur"]),
    tab_id: z.string(),
    window_id: z.string(),
    previous_tab: z.string().optional(),
    time_since_last_focus: z.number().optional(),
  }),
});

const StorageEvent = BaseEvent.extend({
  event_type: z.literal("storage"),
  data: z.object({
    storage_type: z.enum(["local", "session", "indexed_db", "cache"]),
    action: z.enum(["read", "write", "delete", "clear"]),
    key: z.string().optional(),
    size: z.number().optional(),
    quota: z.number().optional(),
  }),
});

const ResourceEvent = BaseEvent.extend({
  event_type: z.literal("resource"),
  data: z.object({
    resource_type: z.enum(["image", "script", "stylesheet", "font", "other"]),
    url: z.string(),
    duration: z.number(),
    transfer_size: z.number(),
    compression_ratio: z.number().optional(),
    cache_hit: z.boolean().optional(),
    priority: z.string(),
  }),
});

const IdleEvent = BaseEvent.extend({
  event_type: z.literal("idle"),
  data: z.object({
    idle_time: z.number(),
    last_interaction: z.string(),
    is_idle: z.boolean(),
  }),
});

// Export the combined AnalyticsEvent type
export type AnalyticsEvent =
  | z.infer<typeof PageViewEvent>
  | z.infer<typeof ClickEvent>
  | z.infer<typeof ScrollEvent>
  | z.infer<typeof MediaEvent>
  | z.infer<typeof FormEvent>
  | z.infer<typeof ConversionEvent>
  | z.infer<typeof ErrorEvent>
  | z.infer<typeof PerformanceEvent>
  | z.infer<typeof VisibilityEvent>
  | z.infer<typeof CustomEvent>
  | z.infer<typeof LocationEvent>
  | z.infer<typeof TabEvent>
  | z.infer<typeof StorageEvent>
  | z.infer<typeof ResourceEvent>
  | z.infer<typeof IdleEvent>;

export type BatchAnalyticsRequest = {
  events: AnalyticsEvent[];
  browser: z.infer<typeof BrowserInfo>;
  network: z.infer<typeof NetworkInfo>;
  device: z.infer<typeof DeviceInfo>;
};

// Export the schemas for validation
export const EventSchemas = {
  pageview: PageViewEvent,
  click: ClickEvent,
  scroll: ScrollEvent,
  media: MediaEvent,
  form: FormEvent,
  conversion: ConversionEvent,
  error: ErrorEvent,
  performance: PerformanceEvent,
  visibility: VisibilityEvent,
  custom: CustomEvent,
  location: LocationEvent,
  tab: TabEvent,
  storage: StorageEvent,
  resource: ResourceEvent,
  idle: IdleEvent,
} as const;

export const DeviceSchemas = {
  browserData: BrowserInfo,
  networkData: NetworkInfo,
  deviceData: DeviceInfo,
} as const;
