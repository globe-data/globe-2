import {
  EventTypes,
  AnalyticsEventUnion,
  ClickData,
  ScrollData,
  MediaData,
  ConversionData,
  ErrorData,
  VisibilityData,
  ResourceData,
  IdleData,
  TabData,
  LocationData,
  StorageData,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
  QueuedEvent,
  VisibilityState,
  AnalyticsBatch,
} from "./types/events";
import { openDB } from "idb";

const API_URL = "http://localhost:8000/api/analytics";

/**
 * Optimized Analytics class using modern browser APIs and performance best practices
 */

class TransferableBuffer {
  private buffer: SharedArrayBuffer | ArrayBuffer;
  private view: Int32Array;
  private offset = 0;

  constructor(size: number) {
    const BufferConstructor =
      typeof SharedArrayBuffer !== "undefined"
        ? SharedArrayBuffer
        : ArrayBuffer;
    this.buffer = new BufferConstructor(size);
    this.view = new Int32Array(this.buffer);
  }

  write(data: number): boolean {
    if (this.offset >= this.view.length) return false;
    this.view[this.offset++] = data;
    return true;
  }

  read(): Int32Array {
    return this.view.slice(0, this.offset);
  }

  clear(): void {
    this.offset = 0;
  }
}

class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private _size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  drain(): T[] {
    const items: T[] = [];
    while (this._size > 0) {
      items.push(this.buffer[this.tail]);
      this.tail = (this.tail + 1) % this.capacity;
      this._size--;
    }
    return items;
  }

  get size(): number {
    return this._size;
  }
}

interface PrivacySettings {
  gdprConsent: boolean;
  ccpaCompliance: boolean;
  dataRetentionDays: number;
  allowedDataTypes: EventTypes[];
  ipAnonymization: boolean;
  sensitiveDataFields: string[];
  cookiePreferences: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    advertising: boolean;
  };
}

class Analytics {
  private static instance: Analytics | null = null;
  private readonly worker: Worker | null = null;
  private readonly sessionId = crypto.randomUUID();
  private currentUserId: string | null = null;

  private readonly batchSize = 50;

  // Optimized storage
  private readonly eventQueue = new RingBuffer<QueuedEvent>(1000);
  private readonly idCache: Int32Array;
  private readonly throttleMap = new Map<EventTypes, DOMHighResTimeStamp>();

  // Additional tracking state
  private lastScrollPosition = 0;
  private lastIdleTime = performance.now();
  private readonly scrollThresholds = new Set<number>();
  private mediaElements = new WeakMap<HTMLMediaElement, MediaData>();
  private privacySettings!: PrivacySettings;

  // Performance monitoring
  private readonly performanceMetrics = new Map<string, number>();
  private readonly resourceTimings = new Set<string>();

  private visibilityMetrics: Map<
    Element,
    {
      timeFirstSeen: number;
      totalVisibleTime: number;
      lastSeenTime: number;
      isVisible: boolean;
    }
  > = new Map();

  private readonly clickMetrics: Map<
    string,
    {
      lastClick: number;
      clickCount: number;
      interactions: Set<string>;
    }
  > = new Map();

  private constructor() {
    try {
      // Initialize worker with proper path relative to HTML file
      // const workerPath = new URL("/analytics.worker.js", import.meta.url).href;
      const workerPath = "./analytics.worker.js";
      this.worker = new Worker(workerPath, { type: "module" });

      // Initialize required properties
      this.initializePrivacySettings();
      this.initialize();

      // Ensure worker is ready
      this.worker.onmessage = this.handleWorkerMessage;
      this.worker.onerror = this.handleWorkerError;

      // Start processing events
      setInterval(() => {
        const events = this.eventQueue.drain();
        if (!events.length || !this.worker) return;

        const analyticsEvents = this.transformQueuedEvents(events);

        this.worker.postMessage({
          type: "PROCESS_BATCH",
          events: analyticsEvents,
          sessionId: this.sessionId,
          device: this.getDeviceInfo(),
          browser: this.getBrowserInfo(),
          network: this.getNetworkInfo(),
          timestamp: Date.now(),
        } as AnalyticsBatch);
      }, 5000);
    } catch (error) {
      console.error("Failed to initialize analytics:", error);
    }

    // Fallback to regular ArrayBuffer if SharedArrayBuffer isn't available
    const bufferConstructor =
      typeof SharedArrayBuffer !== "undefined"
        ? SharedArrayBuffer
        : ArrayBuffer;

    this.idCache = new Int32Array(new bufferConstructor(4000));
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  private initializePrivacySettings(): void {
    this.privacySettings = {
      gdprConsent: true,
      ccpaCompliance: true,
      dataRetentionDays: 90,
      allowedDataTypes: Object.values(EventTypes),
      ipAnonymization: false,
      sensitiveDataFields: [],
      cookiePreferences: {
        necessary: true,
        functional: true,
        analytics: true,
        advertising: true,
      },
    };
  }

  private initialize(): void {
    // Use Intersection Observer for visibility tracking
    this.setupIntersectionTracking();

    // Event delegation for interactions
    document.addEventListener("click", this.handleClick, {
      passive: true,
      capture: true,
    });

    // Additional event listeners
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("storage", this.handleStorage);
    document.addEventListener("visibilitychange", this.handleVisibility);

    // Setup specialized tracking
    try {
      this.setupMediaTracking();
      this.setupResourceTracking();
      this.setupTabTracking();
      this.setupLocationTracking();
      this.setupIdleTracking();
      this.setupFormTracking();
      this.setupErrorTracking();
      this.setupConversionTracking();
      this.setupPerformanceTracking();
      this.setupMediaTracking();
      this.setupScrollTracking();
    } catch (error) {
      console.error("Failed to initialize analytics:", error);
    }

    // Handle page unload
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flushEvents();
      }
    });
  }

  private setupIntersectionTracking(): void {
    // Create a single observer for all elements we want to track
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!this.shouldTrackEvent(EventTypes.visibility)) return;

          const element = entry.target;
          const now = performance.now();
          const metrics = this.getOrCreateMetrics(element);

          if (entry.isIntersecting) {
            // Element became visible
            metrics.isVisible = true;
            metrics.lastSeenTime = now;

            if (!metrics.timeFirstSeen) {
              metrics.timeFirstSeen = now;
            }
          } else {
            // Element became hidden
            metrics.isVisible = false;
            if (metrics.lastSeenTime) {
              metrics.totalVisibleTime += now - metrics.lastSeenTime;
            }
          }

          const visibilityData: VisibilityData = {
            visibility_state: entry.isIntersecting ? "visible" : "hidden",
            element_id: element.id || undefined,
            element_type: element.tagName.toLowerCase(),
            visibility_ratio: entry.intersectionRatio,
            time_visible: metrics.totalVisibleTime,
            viewport_area:
              entry.intersectionRect.width * entry.intersectionRect.height,
            intersection_rect: {
              top: entry.intersectionRect.top,
              left: entry.intersectionRect.left,
              bottom: entry.intersectionRect.bottom,
              right: entry.intersectionRect.right,
            },
          };

          this.queueEvent(EventTypes.visibility, visibilityData);
        });
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0],
        rootMargin: "50px",
      }
    );

    // Track important elements
    this.observeImportantElements(observer);

    // Setup mutation observer to track new elements
    this.setupDynamicElementTracking(observer);

    // Cleanup function for when analytics is destroyed
    observer.disconnect();
    this.visibilityMetrics.clear();
  }

  private getOrCreateMetrics(element: Element) {
    if (!this.visibilityMetrics.has(element)) {
      this.visibilityMetrics.set(element, {
        timeFirstSeen: 0,
        totalVisibleTime: 0,
        lastSeenTime: 0,
        isVisible: false,
      });
    }
    return this.visibilityMetrics.get(element)!;
  }

  private observeImportantElements(observer: IntersectionObserver): void {
    const selectors = [
      // Interactive elements
      "button",
      "a",
      "form",
      "input",
      "select",
      "textarea",
      // Content elements
      "article",
      "section",
      "main",
      "header",
      "footer",
      // Custom trackable elements
      "[data-track-visibility]",
      "[data-analytics-id]",
      // Important content
      "h1",
      "h2",
      "img",
      "video",
      // Interactive components
      '[role="button"]',
      '[role="tab"]',
      '[role="dialog"]',
      // Custom components
      ".component",
      ".widget",
      ".modal",
    ].join(",");

    document.querySelectorAll(selectors).forEach((element) => {
      if (this.shouldTrackElement(element)) {
        observer.observe(element);
      }
    });
  }

  private setupDynamicElementTracking(observer: IntersectionObserver): void {
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element && this.shouldTrackElement(node)) {
            observer.observe(node);
          }
        });

        mutation.removedNodes.forEach((node) => {
          if (node instanceof Element) {
            this.visibilityMetrics.delete(node);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private shouldTrackElement(element: Element): boolean {
    // Skip elements that are too small
    const rect = element.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;

    // Track elements that:
    if (element.hasAttribute("data-track-visibility")) return true;
    if (element.hasAttribute("data-analytics-id")) return true;
    if (element.matches("button, a, form, input, select, textarea, div"))
      return true;
    if (element.matches("article, section, main, header, footer")) return true;
    if (element.matches("h1, h2, img, video")) return true;
    if (element.getAttribute("role") === "button") return true;
    if (element.classList.contains("component")) return true;
    if (element.classList.contains("widget")) return true;
    if (element.classList.contains("modal")) return true;

    return false;
  }

  private handleVisibility = (): void => {
    if (!this.shouldTrackEvent(EventTypes.visibility)) return;

    const visibilityData: VisibilityData = {
      visibility_state: document.visibilityState as VisibilityState,
      visibility_ratio: 1,
      element_id: "document",
      element_type: "document",
      time_visible: performance.now() - this.lastIdleTime,
      viewport_area: window.innerWidth * window.innerHeight,
      intersection_rect: {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      },
    };

    this.queueEvent(EventTypes.visibility, visibilityData);
  };

  private setupResourceTracking(): void {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver(
      (list: PerformanceObserverEntryList) => {
        for (const entry of list.getEntries()) {
          if (this.resourceTimings.has(entry.name)) continue;
          const resourceData: ResourceData = {
            resource_type: (entry as PerformanceResourceTiming).initiatorType,
            url: entry.name,
            duration: Math.max(0, entry.duration),
            transfer_size:
              (entry as PerformanceResourceTiming).transferSize || 0,
            compression_ratio: null,
            cache_hit: (entry as PerformanceResourceTiming).transferSize === 0,
            priority: "auto",
          };

          this.queueEvent(EventTypes.resource, resourceData);
          this.resourceTimings.add(entry.name);
        }
      }
    );

    observer.observe({ entryTypes: ["resource"] });
  }

  private setupTabTracking(): void {
    window.addEventListener("focus", () => this.handleTabEvent("focus"));
    window.addEventListener("blur", () => this.handleTabEvent("blur"));
    window.addEventListener("beforeunload", () =>
      this.handleTabEvent("unload")
    );
  }

  private handleTabEvent(action: string): void {
    if (!this.shouldTrackEvent(EventTypes.tab)) return;

    const tabData: TabData = {
      tab_id: crypto.randomUUID(),
      tab_title: document.title,
      tab_url: window.location.href,
    };

    this.queueEvent(EventTypes.tab, tabData);
  }

  private setupLocationTracking(): void {
    const handleLocationChange = (): void => {
      if (!this.shouldTrackEvent(EventTypes.location)) return;

      const locationData: LocationData = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        country: "",
        region: "",
        city: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      this.queueEvent(EventTypes.location, locationData);
    };

    window.addEventListener("popstate", handleLocationChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };
  }

  private setupIdleTracking(): void {
    const idleEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    let lastInteractionType = "none"; // Track the type of interaction

    const handleUserActivity = (event: Event): void => {
      if (!this.shouldTrackEvent(EventTypes.idle)) return;

      const currentTime = performance.now();
      const idleTime = currentTime - this.lastIdleTime;
      lastInteractionType = event.type; // Update the interaction type

      if (idleTime > 30000) {
        const idleData: IdleData = {
          idle_time: idleTime,
          last_interaction: lastInteractionType, // Send the type instead of timestamp
          is_idle: true,
        };

        this.queueEvent(EventTypes.idle, idleData);
      }

      this.lastIdleTime = currentTime;
    };

    idleEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });
  }

  private handleStorage = (event: StorageEvent): void => {
    if (!this.shouldTrackEvent(EventTypes.storage)) return;

    const storageData: StorageData = {
      storage_type: event.storageArea === localStorage ? "local" : "session",
      key: event.key || "",
      value: event.newValue || "",
    };

    this.queueEvent(EventTypes.storage, storageData);
  };

  private handleScroll = (): void => {
    // This is now just a placeholder as scroll handling is done in setupScrollTracking
    return;
  };

  public logConversion(data: Partial<ConversionData>): void {
    if (!this.shouldTrackEvent(EventTypes.conversion)) return;

    this.queueEvent(EventTypes.conversion, {
      ...data,
      timestamp: new Date().toISOString(),
    } as ConversionData);
  }

  public logError(error: Error): void {
    if (!this.shouldTrackEvent(EventTypes.error)) return;

    const errorData: ErrorData = {
      error_type: error.name,
      message: error.message,
      stack_trace: error.stack || null,
      component: "unknown",
    };

    this.queueEvent(EventTypes.error, errorData);
  }

  private shouldTrackEvent(type: EventTypes): boolean {
    return (
      this.privacySettings.allowedDataTypes.includes(type) &&
      this.privacySettings.cookiePreferences.analytics
    );
  }

  private queueEvent(type: EventTypes, data: unknown): void {
    const event: QueuedEvent = {
      id: crypto.randomUUID(),
      event_type: type.toLowerCase() as EventTypes,
      data,
      timestamp: Date.now(),
    };

    this.eventQueue.push(event);
    if (this.eventQueue.size >= this.batchSize) {
      this.flushEvents();
    }
  }

  private async flushEvents(): Promise<void> {
    const events = this.eventQueue.drain();
    if (!events.length || !this.worker) return;

    this.worker.postMessage({
      type: "PROCESS_BATCH",
      events, // Send raw events to worker
      sessionId: this.sessionId,
      deviceInfo: this.getDeviceInfo(),
      browserInfo: this.getBrowserInfo(),
      networkInfo: this.getNetworkInfo(),
      timestamp: Date.now(),
    });
  }

  private async compressEvents(batch: {
    events: AnalyticsEventUnion[];
    browser: BrowserInfo;
    device: DeviceInfo;
    network: NetworkInfo;
  }): Promise<Uint8Array> {
    const stream = new CompressionStream("gzip");
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    await writer.write(encoder.encode(JSON.stringify(batch)));
    await writer.close();

    return new Response(stream.readable)
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer));
  }

  private async storeForRetry(events: QueuedEvent[]): Promise<void> {
    const db = await openDB("analytics", 1, {
      upgrade(db) {
        db.createObjectStore("failed_events", { keyPath: "timestamp" });
      },
    });

    const analyticsEvents = this.transformQueuedEvents(events);

    const tx = db.transaction("failed_events", "readwrite");
    const store = tx.objectStore("failed_events");

    await Promise.all(
      analyticsEvents.map((event) =>
        store.add({ ...event, timestamp: Date.now() })
      )
    );
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.shouldTrackEvent(EventTypes.click)) return;

    const target = event.target as Element;
    if (!target || !this.shouldTrackElement(target)) return;

    // Get element path efficiently
    const path = this.getElementPath(target);
    const elementId = target.id || path;

    // Update metrics
    const metrics = this.getOrCreateClickMetrics(elementId);
    const now = performance.now();

    // Rate limiting for rapid clicks
    if (now - metrics.lastClick < 100) return; // Ignore clicks within 100ms

    metrics.lastClick = now;
    metrics.clickCount++;
    metrics.interactions.add(this.getInteractionType(target));

    const clickData: ClickData = {
      element_path: path,
      element_text: this.getElementText(target),
      target: this.getElementProperties(target),
      page: {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
      x_pos: event.pageX,
      y_pos: event.pageY,
      href: target instanceof HTMLAnchorElement ? target.href : null,
      interaction_count: metrics.clickCount,
      interaction_types: Array.from(metrics.interactions),
      is_programmatic: event.isTrusted === false,
      element_metadata: {
        accessibility: {
          role: target.getAttribute("role"),
          label: target.getAttribute("aria-label"),
          description: target.getAttribute("aria-description"),
        },
        interactivity: {
          is_focusable: (target as HTMLElement).tabIndex >= 0,
          is_disabled: target.hasAttribute("disabled"),
          tab_index: target.getAttribute("tabindex"),
        },
      },
    };

    this.queueEvent(EventTypes.click, clickData);
  };

  private getElementPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID is unique, no need to go further
      } else {
        const classes = Array.from(current.classList)
          .filter((c) => !c.startsWith("js-")) // Filter out dynamic classes
          .join(".");
        if (classes) selector += `.${classes}`;

        const siblings = Array.from(
          current.parentElement?.children || []
        ).filter((el) => el.tagName === current?.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(" > ");
  }

  private getElementText(element: Element): string {
    // Get visible text content only
    return element.textContent?.trim().slice(0, 100) || "";
  }

  private getElementProperties(element: Element): {
    tag: string;
    classes: string[];
    attributes: Record<string, string>;
    dimensions: DOMRect;
    visible: boolean;
  } {
    return {
      tag: element.tagName.toLowerCase(),
      classes: Array.from(element.classList),
      attributes: this.getElementAttributes(element),
      dimensions: element.getBoundingClientRect(),
      visible: this.isElementVisible(element),
    };
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
      if (!attr.name.startsWith("data-internal-")) {
        attrs[attr.name] = attr.value;
      }
    }
    return attrs;
  }

  private getOrCreateClickMetrics(elementId: string) {
    if (!this.clickMetrics.has(elementId)) {
      this.clickMetrics.set(elementId, {
        lastClick: 0,
        clickCount: 0,
        interactions: new Set(),
      });
    }
    return this.clickMetrics.get(elementId)!;
  }

  private getInteractionType(element: Element): string {
    if (element.matches('button, [role="button"]')) return "button";
    if (element.matches("a")) return "link";
    if (element.matches("input, select, textarea")) return "form-control";
    if (element.matches("[data-analytics-type]")) {
      return element.getAttribute("data-analytics-type") || "custom";
    }
    return "other";
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      window.getComputedStyle(element).visibility !== "hidden"
    );
  }

  private handleWorkerMessage = (event: MessageEvent): void => {
    const { success, metadata, error } = event.data;
    if (!success) {
      console.error("[handleWorkerMessage] Analytics worker error:", error);
      return;
    }
    // Handle successful processing
    this.performanceMetrics.set("lastBatchSize", metadata.eventCount);
    this.performanceMetrics.set(
      "lastProcessingTime",
      metadata.processedAt - metadata.timestamp
    );
  };

  private handleWorkerError = (error: ErrorEvent): void => {
    console.error("[handleWorkerError] Analytics worker error:", error);
    // Implement fallback processing
  };

  private getBrowserInfo(): BrowserInfo {
    return {
      user_agent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      vendor: navigator.vendor || null,
      cookies_enabled: navigator.cookieEnabled,
      do_not_track: navigator.doNotTrack === "1",
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      time_zone_offset: new Date().getTimezoneOffset(),
    };
  }

  private getDeviceInfo(): DeviceInfo {
    return {
      screen_resolution: {
        width: window.screen.width,
        height: window.screen.height,
      },
      color_depth: window.screen.colorDepth,
      pixel_ratio: window.devicePixelRatio,
      max_touch_points: navigator.maxTouchPoints,
      memory: (navigator as any).deviceMemory || null,
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory: (navigator as any).deviceMemory || null,
    };
  }

  private getNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection;
    return {
      connection_type: connection?.type || "unknown",
      downlink: connection?.downlink || 0,
      effective_type: connection?.effectiveType || "unknown",
      rtt: connection?.rtt || 0,
      save_data: connection?.saveData || false,
      anonymize_ip: false,
    };
  }

  private setupScrollTracking(): void {
    // Track last scroll position and time
    let lastScrollY = window.scrollY;
    let lastScrollTime = Date.now();
    let scrollTimeout: number | null = null;

    // Minimum scroll distance (in pixels) to track
    const MIN_SCROLL_DISTANCE = 100;
    // Minimum time (in ms) between scroll events
    const SCROLL_THROTTLE = 1000;
    // Debounce time for final scroll position
    const SCROLL_DEBOUNCE = 1500;

    const handleScroll = () => {
      // First check if we should track scroll events
      if (!this.shouldTrackEvent(EventTypes.scroll)) return;

      const now = Date.now();
      const currentY = window.scrollY;
      const scrollDelta = Math.abs(currentY - lastScrollY);

      // Only track if enough time has passed AND scroll distance is significant
      if (
        scrollDelta >= MIN_SCROLL_DISTANCE &&
        now - lastScrollTime >= SCROLL_THROTTLE
      ) {
        const scrollData: ScrollData = {
          depth: currentY,
          direction: currentY > lastScrollY ? "down" : "up",
          max_depth: document.documentElement.scrollHeight - window.innerHeight,
          relative_depth: Math.round(
            (currentY /
              (document.documentElement.scrollHeight - window.innerHeight)) *
              100
          ),
        };

        this.queueEvent(EventTypes.scroll, scrollData);
        lastScrollY = currentY;
        lastScrollTime = now;
      }

      // Debounce the final scroll position
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout);
      }

      scrollTimeout = window.setTimeout(() => {
        // Check again in case settings changed during scroll
        if (!this.shouldTrackEvent(EventTypes.scroll)) return;

        // Only send final position if it's different from last tracked position
        if (Math.abs(window.scrollY - lastScrollY) >= MIN_SCROLL_DISTANCE) {
          const finalScrollData: ScrollData = {
            depth: window.scrollY,
            direction: "final",
            max_depth:
              document.documentElement.scrollHeight - window.innerHeight,
            relative_depth: Math.round(
              (window.scrollY /
                (document.documentElement.scrollHeight - window.innerHeight)) *
                100
            ),
          };
          this.queueEvent(EventTypes.scroll, finalScrollData);
          lastScrollY = window.scrollY;
        }
      }, SCROLL_DEBOUNCE);
    };

    // Use passive listener for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });
  }

  private setupFormTracking(): void {
    // Track all form submissions using event delegation
    document.addEventListener(
      "submit",
      (e: Event) => {
        if (!this.shouldTrackEvent(EventTypes.form)) return;

        const form = e.target as HTMLFormElement;
        if (!this.shouldTrackElement(form)) return;

        // Don't track sensitive forms
        if (
          form.getAttribute("data-analytics-ignore") ||
          form.matches("form[id*=password], form[id*=login], form[id*=signin]")
        )
          return;

        const formData = new FormData(form);
        const safeFormData: Record<string, string> = {};

        // Only collect safe, non-sensitive form fields
        formData.forEach((value, key) => {
          if (
            !key.toLowerCase().includes("password") &&
            !key.toLowerCase().includes("token") &&
            !key.toLowerCase().includes("credit") &&
            !key.toLowerCase().includes("card")
          ) {
            safeFormData[key] =
              typeof value === "string" ? value : "file-upload";
          }
        });

        this.queueEvent(EventTypes.form, {
          form_id: form.id || this.getElementPath(form),
          form_name: form.getAttribute("name") || form.id || "unnamed-form",
          form_action: form.action,
          form_method: form.method,
          field_count: form.elements.length,
          fields: safeFormData,
          has_file_upload: form.enctype === "multipart/form-data",
          timestamp: new Date().toISOString(),
        });
      },
      { passive: true, capture: true }
    );
  }

  private setupErrorTracking(): void {
    // Global error handling
    window.addEventListener("error", (event: ErrorEvent) => {
      if (!this.shouldTrackEvent(EventTypes.error)) return;

      this.queueEvent(EventTypes.error, {
        error_type: event.error?.name || "Unknown",
        message: event.error?.message || event.message,
        stack_trace: event.error?.stack,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        timestamp: new Date().toISOString(),
      });
    });

    // Promise rejection handling
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        if (!this.shouldTrackEvent(EventTypes.error)) return;

        this.queueEvent(EventTypes.error, {
          error_type: "UnhandledPromiseRejection",
          message: event.reason?.message || String(event.reason),
          stack_trace: event.reason?.stack,
          timestamp: new Date().toISOString(),
        });
      }
    );
  }

  private setupConversionTracking(): void {
    // Track elements with conversion attributes
    document.addEventListener(
      "click",
      (event: MouseEvent) => {
        if (!this.shouldTrackEvent(EventTypes.conversion)) return;

        const target = event.target as Element;
        if (!target || !this.shouldTrackElement(target)) return;

        const conversionData = target.getAttribute("data-analytics-conversion");
        if (!conversionData) return;

        try {
          const conversion = JSON.parse(conversionData);
          this.queueEvent(EventTypes.conversion, {
            type: conversion.type || "click",
            value: conversion.value,
            currency: conversion.currency || "USD",
            product_id: conversion.product_id,
            category: conversion.category,
            element_path: this.getElementPath(target),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.error("Invalid conversion data format:", error);
        }
      },
      { passive: true, capture: true }
    );
  }

  private setupPerformanceTracking(): void {
    if ("PerformanceObserver" in window) {
      const pageLoadObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "navigation") {
            const navEntry = entry as PerformanceNavigationTiming;
            this.queueEvent(EventTypes.performance, {
              metric_name: "navigation",
              value: navEntry.loadEventEnd - navEntry.startTime,
              navigation_type: "navigate",
              effective_connection_type:
                (navigator as any).connection?.effectiveType || "unknown",
            });
          }
        });
      });

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.queueEvent(EventTypes.performance, {
          metric_name: "lcp",
          value: lastEntry.startTime,
          navigation_type: "navigate",
          effective_connection_type:
            (navigator as any).connection?.effectiveType || "unknown",
        });
      });

      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.queueEvent(EventTypes.performance, {
            metric_name: "fid",
            value: entry.duration,
            navigation_type: "navigate",
            effective_connection_type:
              (navigator as any).connection?.effectiveType || "unknown",
          });
        });
      });

      try {
        pageLoadObserver.observe({ entryTypes: ["navigation"] });
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
        fidObserver.observe({ entryTypes: ["first-input"] });
      } catch (error) {
        console.error("Performance observer error:", error);
      }
    }
  }

  private setupMediaTracking(): void {
    // Track all video and audio elements using event delegation
    document.addEventListener("play", this.handleMediaEvent, { capture: true });
    document.addEventListener("pause", this.handleMediaEvent, {
      capture: true,
    });
    document.addEventListener("ended", this.handleMediaEvent, {
      capture: true,
    });
    document.addEventListener("timeupdate", this.handleMediaEvent, {
      capture: true,
    });
    document.addEventListener("seeking", this.handleMediaEvent, {
      capture: true,
    });
  }

  private handleMediaEvent = (event: Event): void => {
    if (!this.shouldTrackEvent(EventTypes.media)) return;

    const media = event.target as HTMLMediaElement;
    if (!media || !this.shouldTrackElement(media)) return;

    // Only track every 10% progress for timeupdate
    if (event.type === "timeupdate") {
      const progress = (media.currentTime / media.duration) * 100;
      if (progress % 10 !== 0) return;
    }

    this.queueEvent(EventTypes.media, {
      media_type: media instanceof HTMLVideoElement ? "video" : "audio",
      action: event.type,
      media_url: media.currentSrc,
      playback_time: media.currentTime,
      duration: media.duration,
      progress_percentage: media.duration
        ? (media.currentTime / media.duration) * 100
        : 0,
      timestamp: new Date().toISOString(),
      media_id: media.id || this.getElementPath(media),
      is_muted: media.muted,
      volume: media.volume,
      playback_rate: media.playbackRate,
      title: media.title || null,
    });
  };

  private transformQueuedEvents(events: QueuedEvent[]): AnalyticsEventUnion[] {
    return events.map((event) => {
      const baseEvent = {
        event_id: event.id,
        globe_id: this.sessionId,
        session_id: this.sessionId,
        timestamp: new Date().toISOString(),
        client_timestamp: new Date(event.timestamp).toISOString(),
        event_type: event.event_type,
        data: event.data,
      };

      if (event.event_type === EventTypes.custom) {
        return {
          ...baseEvent,
          name: (event.data as { name: string }).name,
        };
      }

      return baseEvent;
    }) as AnalyticsEventUnion[];
  }

  // Update performance tracking
  private handlePerformanceEntry = (entry: PerformanceEntry): void => {
    if (!this.shouldTrackEvent(EventTypes.performance)) return;

    const performanceData = {
      metric_name: entry.entryType,
      value: entry.duration || entry.startTime,
      navigation_type: "navigate",
      effective_connection_type:
        (navigator as any).connection?.effectiveType || "unknown",
    };

    this.queueEvent(EventTypes.performance, performanceData);
  };
}

export default Analytics.getInstance();
