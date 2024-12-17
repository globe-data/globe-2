// analytics.worker.ts
import {
  AnalyticsEventUnion,
  AnalyticsBatch,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
  QueuedEvent,
} from "./types/events";

// Constants for processing
const COMPRESSION_CHUNK_SIZE = 16384; // 16KB chunks
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const API_ENDPOINT = "http://localhost:8000/api/analytics/batch";

// Cache for processed data
const processedCache = new Map<string, ArrayBuffer>();

// Initialize compression streams
const encoder = new TextEncoder();
const compressionStream = new CompressionStream("gzip");

interface WorkerMessage {
  events: QueuedEvent[];
  sessionId: string;
  deviceInfo?: DeviceInfo;
  browserInfo?: BrowserInfo;
  networkInfo?: NetworkInfo;
  timestamp: number;
}

/**
 * Main message handler for the Web Worker
 */
self.onmessage = async ({ data }: MessageEvent<WorkerMessage>) => {
  try {
    const processedBatch = await processBatch(data);
    const compressedData = await compressBatch(processedBatch);

    // Send processed data back to main thread
    self.postMessage(
      {
        success: true,
        data: compressedData,
        metadata: {
          originalSize: processedBatch.byteLength,
          compressedSize: compressedData.byteLength,
          eventCount: data.events.length,
          timestamp: Date.now(),
        },
      },
      { transfer: [compressedData.buffer] }
    );
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    });
  }
};

/**
 * Process a batch of analytics events
 */
async function processBatch({
  events,
  sessionId,
  deviceInfo,
  browserInfo,
  networkInfo,
  timestamp,
}: WorkerMessage): Promise<ArrayBuffer> {
  // Deduplicate events
  const uniqueEvents = deduplicateEvents(events);

  // Enrich events with additional data
  const enrichedEvents = enrichEvents(uniqueEvents, {
    sessionId,
    deviceInfo,
    browserInfo,
    networkInfo,
    timestamp,
  });

  // Validate events
  const validatedEvents = validateEvents(enrichedEvents);

  // Create the batch object
  const batch: AnalyticsBatch = {
    batchId: crypto.randomUUID(),
    timestamp,
    sessionId,
    events: validatedEvents,
    metadata: {
      processedAt: Date.now(),
      eventCount: validatedEvents.length,
      originalCount: events.length,
    },
    browser: browserInfo as BrowserInfo,
    device: deviceInfo as DeviceInfo,
    network: networkInfo as NetworkInfo,
  };

  // Convert to ArrayBuffer for efficient transfer
  return encoder.encode(JSON.stringify(batch)).buffer;
}

/**
 * Compress processed batch data
 */
async function compressBatch(batchBuffer: ArrayBuffer): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  // Process in chunks to avoid memory issues
  while (offset < batchBuffer.byteLength) {
    const chunk = new Uint8Array(
      batchBuffer.slice(offset, offset + COMPRESSION_CHUNK_SIZE)
    );

    const compressedChunk = await compressChunk(chunk);
    chunks.push(compressedChunk);

    offset += COMPRESSION_CHUNK_SIZE;
  }

  // Combine compressed chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);

  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  return result;
}

/**
 * Compress a single chunk of data
 */
async function compressChunk(chunk: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  await writer.write(chunk);
  await writer.close();

  const reader = stream.readable.getReader();
  const compressedChunks: Uint8Array[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }

  // Combine compressed chunks
  const totalLength = compressedChunks.reduce(
    (sum, chunk) => sum + chunk.length,
    0
  );
  const result = new Uint8Array(totalLength);

  let position = 0;
  for (const chunk of compressedChunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  return result;
}

/**
 * Remove duplicate events based on event ID
 */
function deduplicateEvents(events: QueuedEvent[]): QueuedEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

/**
 * Enrich events with additional metadata
 */
function enrichEvents(
  events: QueuedEvent[],
  context: {
    sessionId: string;
    deviceInfo?: DeviceInfo;
    browserInfo?: BrowserInfo;
    networkInfo?: NetworkInfo;
    timestamp: number;
  }
): AnalyticsEventUnion[] {
  return events.map((event) => {
    const baseEvent = {
      globe_id: event.id,
      event_id: event.id,
      timestamp: new Date().toISOString(),
      session_id: context.sessionId,
      client_timestamp: new Date(event.timestamp).toISOString(),
      event_type: event.type,
      data: event.data,
      name:
        event.type === "custom"
          ? (event.data as any)?.name || "unnamed"
          : undefined,
      enriched: {
        processedAt: Date.now(),
        deviceInfo: context.deviceInfo,
        browserInfo: context.browserInfo,
        networkInfo: context.networkInfo,
        processingLatency: Date.now() - context.timestamp,
      },
    };

    // Cast to unknown first to avoid type checking, then to final type
    return baseEvent as unknown as AnalyticsEventUnion;
  });
}
/**
 * Validate events before processing
 */
function validateEvents(events: AnalyticsEventUnion[]): AnalyticsEventUnion[] {
  return events.filter((event) => {
    try {
      // Basic validation
      if (!event.globe_id || !event.event_type || !event.timestamp) {
        return false;
      }

      // Validate timestamp is reasonable
      const eventTime = new Date(event.timestamp).getTime();
      const now = Date.now();
      if (eventTime > now || eventTime < now - 86400000) {
        // Within last 24 hours
        return false;
      }

      // Validate data based on event type
      switch (event.event_type) {
        case "pageview":
          return validatePageView(event.data);
        case "click":
          return validateClickEvent(event.data);
        case "custom":
          return validateCustomEvent(event.data);
        default:
          return true;
      }
    } catch {
      return false;
    }
  });
}

/**
 * Validate pageview event data
 */
function validatePageView(data: any): boolean {
  return Boolean(
    data &&
      typeof data.url === "string" &&
      data.timestamp &&
      typeof data.timestamp === "number"
  );
}

/**
 * Validate click event data
 */
function validateClickEvent(data: any): boolean {
  return Boolean(
    data &&
      typeof data.x === "number" &&
      typeof data.y === "number" &&
      data.element
  );
}

/**
 * Validate custom event data
 */
function validateCustomEvent(data: any): boolean {
  return Boolean(data && typeof data === "object" && !Array.isArray(data));
}

/**
 * Handle worker errors
 */
self.onerror = (
  event: Event | string,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
) => {
  self.postMessage({
    success: false,
    error: error?.message || "Unknown error",
    timestamp: Date.now(),
  });
};

/**
 * Handle worker termination
 */
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  self.postMessage({
    success: false,
    error: event.reason,
    timestamp: Date.now(),
  });
};
