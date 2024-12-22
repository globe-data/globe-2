// analytics.worker.ts
import {
  AnalyticsEventUnion,
  AnalyticsBatch,
  EventTypes,
  QueuedEvent,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
} from "./types/events";

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
  type: "PROCESS_BATCH" | "RETRY_FAILED";
  events: QueuedEvent[];
  sessionId: string;
  deviceInfo: DeviceInfo;
  browserInfo: BrowserInfo;
  networkInfo: NetworkInfo;
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
  console.log("Received message:", event.data);

  try {
    await initializeDB();

    const { type, ...data } = event.data;

    switch (type) {
      case "PROCESS_BATCH":
        await processBatch(data);
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
  const { events, sessionId, deviceInfo, browserInfo, networkInfo, timestamp } =
    message;

  try {
    // Validate and transform events
    const validatedEvents = events
      .map((event) => validateAndTransformEvent(event, sessionId))
      .filter((event): event is AnalyticsEventUnion => event !== null);

    if (validatedEvents.length === 0) {
      throw new Error("No valid events in batch");
    }

    // Create batch payload
    const batch: AnalyticsBatch = {
      events: validatedEvents,
      browser: browserInfo,
      device: deviceInfo,
      network: networkInfo,
      timestamp: new Date(timestamp).toISOString(),
      sessionId,
    };

    // Attempt to send batch
    const success = await sendBatchToAPI(batch);

    self.postMessage({
      success,
      metadata: {
        eventCount: validatedEvents.length,
        timestamp: Date.now(),
        processedAt: Date.now(),
      },
    });
  } catch (error) {
    await storeBatchForRetry(message);
    throw error;
  }
}

// Validate and transform a single event
function validateAndTransformEvent(
  event: QueuedEvent,
  sessionId: string
): AnalyticsEventUnion | null {
  try {
    console.log("Validating event:", event);

    if (
      !event.event_type ||
      !Object.values(EventTypes).includes(event.event_type)
    ) {
      console.warn(`Invalid event type: ${event.event_type}`);
      return null;
    }

    const baseEvent = {
      globe_id: sessionId,
      event_id: event.id,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      client_timestamp: new Date(event.timestamp).toISOString(),
      event_type: event.event_type,
      data: event.data,
    };

    // Additional validation based on event type
    if (!validateEventData(event.event_type, event.data)) {
      return null;
    }

    return baseEvent as AnalyticsEventUnion;
  } catch (error) {
    console.error("Event validation error:", error);
    return null;
  }
}

// Validate event data based on type
function validateEventData(type: EventTypes, data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const requiredFields: Record<EventTypes, string[]> = {
    [EventTypes.PAGEVIEW]: ["url", "title"],
    [EventTypes.CLICK]: ["element_path", "x_pos", "y_pos"],
    [EventTypes.SCROLL]: ["depth", "direction"],
    [EventTypes.MEDIA]: ["media_type", "action"],
    [EventTypes.FORM]: ["form_id", "action"],
    [EventTypes.CONVERSION]: ["conversion_type", "value"],
    [EventTypes.ERROR]: ["error_type", "message"],
    [EventTypes.PERFORMANCE]: ["metric_name", "value"],
    [EventTypes.VISIBILITY]: ["visibility_state"],
    [EventTypes.LOCATION]: ["latitude", "longitude"],
    [EventTypes.TAB]: ["tab_id"],
    [EventTypes.STORAGE]: ["storage_type", "key"],
    [EventTypes.RESOURCE]: ["resource_type", "url"],
    [EventTypes.IDLE]: ["idle_time"],
    [EventTypes.CUSTOM]: ["name"],
  };

  const fields = requiredFields[type];
  return fields.every((field) => field in (data as Record<string, unknown>));
}

// Send batch to API with retry logic
async function sendBatchToAPI(
  batch: AnalyticsBatch,
  attempt = 1
): Promise<boolean> {
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
    if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
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
