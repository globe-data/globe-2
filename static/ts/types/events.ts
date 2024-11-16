import { z } from "zod";

// Base event type that all others extend from
const BaseEvent = z.object({
  event_id: z.string(),
  timestamp: z.date(),
  session_id: z.string(),
  user_id: z.string(),
  client_timestamp: z.date(),
  event_type: z.string(),
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

const CustomEvent = BaseEvent.extend({
  event_type: z.literal("custom"),
  name: z.string(),
  data: z.record(z.unknown()),
});

// Export the combined Event type
export type Event =
  | z.infer<typeof PageViewEvent>
  | z.infer<typeof ClickEvent>
  | z.infer<typeof ScrollEvent>
  | z.infer<typeof MediaEvent>
  | z.infer<typeof FormEvent>
  | z.infer<typeof ConversionEvent>
  | z.infer<typeof ErrorEvent>
  | z.infer<typeof PerformanceEvent>
  | z.infer<typeof CustomEvent>;

export type BatchAnalyticsRequest = {
  events: Event[];
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
  custom: CustomEvent,
} as const;
