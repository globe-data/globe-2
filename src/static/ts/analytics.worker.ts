// analytics.worker.ts
import axios from "axios";
import {
  EventTypes,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
} from "./types/pydantic_types";
import { AnalyticsEventUnion, EventTypesEnum } from "./types/custom_types";

// Worker configuration
const CONFIG = {
  MAX_BATCH_SIZE: 100,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  COMPRESSION_THRESHOLD: 1024, // 1KB
  API_URL: true
    ? "http://localhost:8000/api"
    : "https://archwyles--globe-test-fastapi-app.modal.run/", // Replace with your production API URL
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
  session?: any; // TODO FIX THIS
}

interface AnalyticsBatch {
  events: AnalyticsEventUnion[];
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

    // Create a structured clone-safe copy of the data
    const safeData = {
      ...data,
      events: data.events?.map((event) => ({
        ...event,
        data: JSON.parse(JSON.stringify(event.data)), // Ensure data is clone-safe
      })),
      browser: data.browser
        ? JSON.parse(JSON.stringify(data.browser))
        : undefined,
      device: data.device ? JSON.parse(JSON.stringify(data.device)) : undefined,
      network: data.network
        ? JSON.parse(JSON.stringify(data.network))
        : undefined,
    };

    switch (type) {
      case "PROCESS_BATCH":
        await processBatch(safeData);
        break;
      case "START_SESSION":
        await startSession(
          safeData as Required<Pick<WorkerMessage, "session">>
        );
        break;
      case "END_SESSION":
        await endSession(safeData);
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
      ?.map((event) => ({
        ...event,
        event_id: event.event_id || crypto.randomUUID(),
        globe_id: "3540c933-c9f7-4025-9415-ae061b825867", // TODO: Replace with dynamic globe_id from auth system
        session_id: sessionId,
      }))
      ?.map((event) => validateEvent(event))
      ?.filter((event): event is AnalyticsEventUnion => event !== null);

    if (!validatedEvents?.length) {
      throw new Error("No valid events in batch");
    }

    if (browser && device && network) {
      await sendBatchToAPI(
        {
          events: validatedEvents,
        },
        "3540c933-c9f7-4025-9415-ae061b825867" // TODO: Replace with dynamic globe_id from auth system
      );
    }
  } catch (error) {
    await storeBatchForRetry(message);
    throw error;
  }
}

// Session management
async function startSession(
  message: Required<Pick<WorkerMessage, "session">>
): Promise<void> {
  // Use the globe_id from the session data
  const sessionData = {
    ...message.session,
    globe_id: message.session.globe_id,
  };

  try {
    const { data } = await axios.post(
      `${CONFIG.API_URL}/sessions`,
      sessionData
    );
    return data;
  } catch (error) {
    throw error;
  }
}

async function endSession({
  sessionId,
}: Pick<WorkerMessage, "sessionId">): Promise<void> {
  try {
    const end_time = new Date().toISOString();
    await axios.patch(
      `${CONFIG.API_URL}/sessions/${sessionId}`,
      { end_time },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    throw error;
  }
}

// Event validation
function validateEvent(event: AnalyticsEventUnion): AnalyticsEventUnion | null {
  try {
    if (event.event_type.toLowerCase() === EventTypesEnum.visibility) {
      return null;
    }

    const eventType = event.event_type.toLowerCase() as EventTypes;

    if (!event.url || !event.domain) {
      return null;
    }

    return validateEventData(eventType, event.data) ? event : null;
  } catch {
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

// compression
const compressBatch = async (
  batch: AnalyticsBatch
): Promise<{ data: string; encoding: string }> => {
  try {
    const jsonString = JSON.stringify(batch);
    const originalSize = new Blob([jsonString]).size;

    if (originalSize < CONFIG.COMPRESSION_THRESHOLD) {
      return {
        data: jsonString,
        encoding: "identity",
      };
    }

    const encoder = new TextEncoder();
    const rawData = encoder.encode(jsonString);
    const cs = new CompressionStream("gzip");
    const compressedStream = new Blob([rawData]).stream().pipeThrough(cs);
    const compressedData = await new Response(compressedStream).arrayBuffer();
    const base64Data = btoa(
      String.fromCharCode(...new Uint8Array(compressedData))
    );

    console.log("Compressed data", base64Data);
    const compressedSize = new Blob([base64Data]).size;
    const compressionRatio = (
      ((originalSize - compressedSize) / originalSize) *
      100
    ).toFixed(2);
    console.log(
      `Compression ratio: ${compressionRatio}% (${originalSize} -> ${compressedSize} bytes)`
    );

    return {
      data: base64Data,
      encoding: "gzip",
    };
  } catch {
    return {
      data: JSON.stringify(batch),
      encoding: "identity",
    };
  }
};

const isDevelopment = () => {
  return (
    CONFIG.API_URL.includes("localhost") || CONFIG.API_URL.includes("127.0.0.1")
  );
};

// API communication
async function sendBatchToAPI(
  batch: AnalyticsBatch,
  globe_id: string = "3540c933-c9f7-4025-9415-ae061b825867", // TODO: Replace with dynamic globe_id from auth system
  attempt = 1,
  compressedData?: { data: string; encoding: string }
): Promise<boolean> {
  try {
    // Ensure the batch data is clone-safe
    const safeBatch = JSON.parse(JSON.stringify(batch));

    safeBatch.events.forEach((event: AnalyticsEventUnion) => {
      event.globe_id = globe_id;
    });

    // Only compress if we don't have compressed data from a previous attempt
    const { data, encoding } =
      compressedData || (await compressBatch(safeBatch));

    console.log("Sending batch to API", safeBatch);
    const response = await fetch(`${CONFIG.API_URL}/analytics/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Encoding": encoding,
      },
      body: data,
      ...(isDevelopment() && {
        mode: "cors",
        cache: "no-cache",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    return true;
  } catch (error) {
    if (attempt < CONFIG.MAX_RETRY_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.RETRY_DELAY_MS * attempt)
      );
      // Pass the compressed data to avoid recompressing
      return sendBatchToAPI(batch, globe_id, attempt + 1, compressedData);
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
      } catch {
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
  // Ignore Cloudflare Worker specific errors about postMessage and transformRequest
  if (
    error instanceof Error &&
    (error.message.includes("DedicatedWorkerGlobalScope") ||
      error.message.includes("transformRequest")) &&
    (error.message.includes("postMessage") ||
      error.message.includes("could not be cloned"))
  ) {
    return;
  }

  const workerError: WorkerError = {
    type: "PROCESSING_ERROR",
    message: error instanceof Error ? error.message : "Unknown error occurred",
    timestamp: Date.now(),
    details: error,
  };

  self.postMessage({ success: false, error: workerError });
}

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  // Ignore Cloudflare Worker specific errors
  if (
    event.reason?.message?.includes("DedicatedWorkerGlobalScope") ||
    event.reason?.message?.includes("transformRequest")
  ) {
    return;
  }
  handleWorkerError(event.reason);
};
