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
  API_URL: "http://localhost:8000/api",
  DB_NAME: "analytics_worker_store",
  DB_VERSION: 1,
  STORE_NAME: "failed_batches",
} as const;

// Types
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
  type: "PROCESS_BATCH" | "RETRY_FAILED" | "END_SESSION" | "START_SESSION";
  sessionId: string;
  events?: AnalyticsEventUnion[];
  device?: DeviceInfo;
  browser?: BrowserInfo;
  network?: NetworkInfo;
  timestamp?: number;
}

interface AnalyticsBatch {
  events: AnalyticsEventUnion[];
  browser: BrowserInfo;
  device: DeviceInfo;
  network: NetworkInfo;
}

// IndexedDB setup
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

// Message handling
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  try {
    await initializeDB();
    const { type, ...data } = event.data;

    switch (type) {
      case "PROCESS_BATCH":
        await processBatch(data);
        break;
      case "START_SESSION":
        await startSession(
          data as Required<
            Pick<WorkerMessage, "sessionId" | "device" | "browser" | "network">
          >
        );
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

// Event processing
async function processBatch(
  message: Omit<WorkerMessage, "type">
): Promise<void> {
  const { events, sessionId, device, browser, network } = message;

  try {
    const validatedEvents = events
      ?.map((event) => validateEvent(event, sessionId))
      .filter((event): event is AnalyticsEventUnion => event !== null);

    if (!validatedEvents?.length) {
      throw new Error("No valid events in batch");
    }

    if (browser && device && network) {
      await sendBatchToAPI({
        events: validatedEvents,
        browser,
        device,
        network,
      });
    }
  } catch (error) {
    await storeBatchForRetry(message);
    throw error;
  }
}

// Session management
async function startSession(
  message: Required<
    Pick<WorkerMessage, "sessionId" | "device" | "browser" | "network">
  >
): Promise<void> {
  const { sessionId, device, browser, network } = message;
  await axios.post(`${CONFIG.API_URL}/sessions`, {
    session_id: sessionId,
    device,
    browser,
    network,
  });
}

async function endSession({
  sessionId,
}: Pick<WorkerMessage, "sessionId">): Promise<void> {
  await axios.patch(`${CONFIG.API_URL}/sessions/${sessionId}`, {
    end_time: new Date().toISOString(),
  });
}

// Event validation
function validateEvent(
  event: AnalyticsEventUnion,
  sessionId: string
): AnalyticsEventUnion | null {
  try {
    if (event.event_type.toLowerCase() === EventTypesEnum.visibility) {
      console.warn(
        "Visibility events cannot be processed in Web Worker context"
      );
      return null;
    }

    const eventType = event.event_type.toLowerCase() as EventTypes;

    if (!event.url || !event.domain) {
      console.error("Missing required fields url/domain:", event);
      return null;
    }

    return validateEventData(eventType, event.data) ? event : null;
  } catch (error) {
    console.error("Event validation error:", error);
    return null;
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

function validateEventData(type: EventTypes, data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return requiredFields[type].every(
    (field) => field in (data as Record<string, unknown>)
  );
}

// API communication
async function sendBatchToAPI(
  batch: AnalyticsBatch,
  attempt = 1
): Promise<boolean> {
  try {
    const response = await fetch(`${CONFIG.API_URL}/analytics/batch`, {
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

// Error handling and retry logic
async function storeBatchForRetry(
  batch: Omit<WorkerMessage, "type">
): Promise<void> {
  if (!db) await initializeDB();

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

function handleWorkerError(error: unknown): void {
  const workerError: WorkerError = {
    type: "PROCESSING_ERROR",
    message: error instanceof Error ? error.message : "Unknown error occurred",
    timestamp: Date.now(),
    details: error,
  };

  self.postMessage({ success: false, error: workerError });
  console.error("[Analytics Worker Error]", workerError);
}

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  handleWorkerError(event.reason);
};
