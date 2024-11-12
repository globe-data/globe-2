import { z } from "zod";
// Base event type that all others extend from
const BaseEvent = z.object({
    event_id: z.string().optional(),
    timestamp: z.date().optional(),
    session_id: z.string(),
    user_id: z.string().optional(),
    client_timestamp: z.date().optional(),
});
const PageViewEvent = BaseEvent.extend({
    event_type: z.literal("pageview"),
    url: z.string(),
    referrer: z.string().optional(),
    title: z.string(),
    path: z.string(),
    viewport: z.object({
        width: z.number(),
        height: z.number(),
    }),
    load_time: z.number().optional(),
});
const ClickEvent = BaseEvent.extend({
    event_type: z.literal("click"),
    element_path: z.string(),
    element_text: z.string().optional(),
    x_pos: z.number(),
    y_pos: z.number(),
    href: z.string().optional(),
});
const ScrollEvent = BaseEvent.extend({
    event_type: z.literal("scroll"),
    depth: z.number(),
    direction: z.enum(["up", "down"]),
    max_depth: z.number(),
    relative_depth: z.number(),
});
const MediaEvent = BaseEvent.extend({
    event_type: z.literal("media"),
    media_type: z.enum(["video", "audio"]),
    action: z.enum(["play", "pause", "complete"]),
    media_url: z.string(),
    current_time: z.number(),
    duration: z.number(),
    title: z.string().optional(),
});
const FormEvent = BaseEvent.extend({
    event_type: z.literal("form"),
    form_id: z.string(),
    action: z.enum(["submit", "abandon"]),
    fields: z.array(z.string()),
    success: z.boolean(),
    error_message: z.string().optional(),
});
const ConversionEvent = BaseEvent.extend({
    event_type: z.literal("conversion"),
    conversion_type: z.string(),
    value: z.number(),
    currency: z.string().default("USD"),
    products: z.array(z.string()).optional(),
});
const ErrorEvent = BaseEvent.extend({
    event_type: z.literal("error"),
    error_type: z.string(),
    message: z.string(),
    stack_trace: z.string().optional(),
    component: z.string().optional(),
});
const PerformanceEvent = BaseEvent.extend({
    event_type: z.literal("performance"),
    metric_name: z.string(),
    value: z.number(),
    navigation_type: z.string().optional(),
    effective_connection_type: z.string().optional(),
});
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
};
