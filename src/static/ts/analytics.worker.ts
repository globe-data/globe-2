// analytics.worker.ts
import {
  EventTypes,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
} from "./types/pydantic_types";
import { AnalyticsEventUnion, EventTypesEnum } from "./types/custom_types";
import axios from "axios";

// Worker configuration
const CONFIG = {
  MAX_BATCH_SIZE: 100,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  COMPRESSION_THRESHOLD: 1024, // 1KB
  API_ENDPOINT: "http://localhost:8000/api/analytics/batch",
  DB_NAME: "analytics_worker_store",
  DB_VERSION: 1,
  STORE_NAME: "failed_batches",
} as const;

// Error handling
type WorkerErrorType =
  | "VALIDATION_ERROR"
  | "PROCESSING_ERROR"
  | "NETWORK_ERROR"
  | "STORAGE_ERROR"
  | "COMPRESSION_ERROR";

interface WorkerError {
  type: WorkerErrorType;
  message: string;
  timestamp: number;
  details?: unknown;
}

interface WorkerMessage {
  type: "PROCESS_BATCH" | "RETRY_FAILED" | "END_SESSION";
  events: AnalyticsEventUnion[];
  sessionId: string;
  device: DeviceInfo;
  browser: BrowserInfo;
  network: NetworkInfo;
  timestamp: number;
}

// IndexedDB setup for failed batch storage
let db: IDBDatabase | null = null;

async function initializeDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

    request.onerror = () => reject(new Error("Failed to open IndexedDB"));

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(CONFIG.STORE_NAME)) {
        database.createObjectStore(CONFIG.STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  try {
    await initializeDB();

    const { type, ...data } = event.data;

    switch (type) {
      case "PROCESS_BATCH":
        await processBatch(data);
        break;
      case "END_SESSION":
        await endSession(data);
        break;
      case "RETRY_FAILED":
        await retryFailedBatches();
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    handleWorkerError(error);
  }
};

// Process incoming batch
async function processBatch(
  message: Omit<WorkerMessage, "type">
): Promise<void> {
  const { events, sessionId, device, browser, network } = message;

  try {
    const validatedEvents = events
      .map((event) => {
        const transformed = validateEvent(event, sessionId);
        if (!transformed) {
          console.error("Failed to validate event:", event);
        }
        return transformed;
      })
      .filter((event): event is AnalyticsEventUnion => event !== null);

    if (validatedEvents.length === 0) {
      throw new Error("No valid events in batch");
    }

    // Create the batch with all required fields
    const batch = {
      events: validatedEvents,
      browser: browser, // Include browser info
      device: device, // Include device info
      network: network, // Include network info
    };
    await sendBatchToAPI(batch);
  } catch (error) {
    await storeBatchForRetry(message);
    throw error;
  }
}

async function endSession(message: { sessionId: string }): Promise<void> {
  const { sessionId } = message;
  const res = await axios.patch(
    `http://localhost:8000/api/sessions/${sessionId}`,
    {
      end_time: new Date().toISOString(),
    }
  );
  console.log("Session ended:", res.data);
}

// Validate and transform a single event
function validateEvent(
  event: AnalyticsEventUnion,
  sessionId: string
): AnalyticsEventUnion | null {
  try {
    // Add check for visibility events
    if (event.event_type.toLowerCase() === EventTypesEnum.visibility) {
      console.warn(
        "Visibility events cannot be processed in Web Worker context"
      );
      return null;
    }

    // Add missing required fields
    const baseEvent = event;

    const eventType = baseEvent.event_type.toLowerCase() as EventTypes;

    // Ensure required base fields are present
    if (!baseEvent.url || !baseEvent.domain) {
      console.error("Missing required fields url/domain:", baseEvent);
      return null;
    }

    // Create the base event with event_id
    if (!validateEventData(eventType, baseEvent.data)) {
      return null;
    }

    return baseEvent as AnalyticsEventUnion;
  } catch (error) {
    console.error("Event validation error:", error);
    return null;
  }
}

function sanitizeEventData(type: EventTypes, data: any): any {
  switch (type) {
    case EventTypesEnum.performance:
      return {
        metric_name: data.metric_name,
        value: data.value,
        navigation_type: data.navigation_type || "navigate",
        effective_connection_type: data.effective_connection_type || "unknown",
      };

    case EventTypesEnum.resource:
      return {
        resource_type: data.resource_type,
        url: data.url,
        duration: Math.max(0, data.duration),
        transfer_size: data.transfer_size || 0,
        compression_ratio: data.compression_ratio || null,
        cache_hit: data.cache_hit || false,
        priority: data.priority || "auto",
      };

    // Add other cases as needed
    default:
      return data;
  }
}

const requiredFields: Record<EventTypes, string[]> = {
  [EventTypesEnum.pageview]: ["url", "title"],
  [EventTypesEnum.click]: ["element_path", "x_pos", "y_pos"],
  [EventTypesEnum.scroll]: ["depth", "direction"],
  [EventTypesEnum.media]: ["media_type", "action"],
  [EventTypesEnum.form]: ["form_id", "action"],
  [EventTypesEnum.conversion]: ["conversion_type", "value"],
  [EventTypesEnum.error]: ["error_type", "message"],
  [EventTypesEnum.performance]: ["metric_name", "value"],
  [EventTypesEnum.visibility]: ["visibility_state", "visibility_ratio"],
  [EventTypesEnum.location]: ["latitude", "longitude"],
  [EventTypesEnum.tab]: ["tab_id"],
  [EventTypesEnum.storage]: ["storage_type", "key"],
  [EventTypesEnum.resource]: ["resource_type", "url"],
  [EventTypesEnum.idle]: ["idle_time"],
  [EventTypesEnum.custom]: ["name"],
};
// Validate event data based on type
function validateEventData(type: EventTypes, data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const fields = requiredFields[type];
  return fields.every((field) => field in (data as Record<string, unknown>));
}

// Send batch to API with retry logic
async function sendBatchToAPI(
  batch: {
    events: AnalyticsEventUnion[];
    browser: BrowserInfo;
    device: DeviceInfo;
    network: NetworkInfo;
  },
  attempt = 1
): Promise<boolean> {
  // console.log("Sending batch to API:", JSON.stringify(batch.events, null, 2));

  try {
    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    // if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
    if (attempt < 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.RETRY_DELAY_MS * attempt)
      );
      return sendBatchToAPI(batch, attempt + 1);
    }
    throw error;
  }
}

// Store failed batch for later retry
async function storeBatchForRetry(
  batch: Omit<WorkerMessage, "type">
): Promise<void> {
  if (!db) {
    await initializeDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([CONFIG.STORE_NAME], "readwrite");
    const store = transaction.objectStore(CONFIG.STORE_NAME);

    const request = store.add({
      ...batch,
      retryCount: 0,
      storedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Retry failed batches
async function retryFailedBatches(): Promise<void> {
  if (!db) throw new Error("Database not initialized");

  const transaction = db.transaction([CONFIG.STORE_NAME], "readwrite");
  const store = transaction.objectStore(CONFIG.STORE_NAME);

  const request = store.getAll();

  request.onsuccess = async () => {
    const failedBatches = request.result;

    for (const batch of failedBatches) {
      try {
        await processBatch(batch);
        await store.delete(batch.id);
      } catch (error) {
        if (batch.retryCount >= CONFIG.MAX_RETRY_ATTEMPTS) {
          await store.delete(batch.id);
        } else {
          batch.retryCount++;
          await store.put(batch);
        }
      }
    }
  };
}

// Error handling
function handleWorkerError(error: unknown): void {
  const workerError: WorkerError = {
    type: "PROCESSING_ERROR",
    message: error instanceof Error ? error.message : "Unknown error occurred",
    timestamp: Date.now(),
    details: error,
  };

  self.postMessage({
    success: false,
    error: workerError,
  });

  console.error("[Analytics Worker Error]", workerError);
}

// Handle unhandled rejections
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  handleWorkerError(event.reason);
};
