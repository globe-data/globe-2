import {
  EventTypes,
  AnalyticsEventUnion,
  PageViewData,
  ClickData,
  ScrollData,
  MediaData,
  FormData,
  ConversionData,
  ErrorData,
  PerformanceData,
  VisibilityData,
  ResourceData,
  IdleData,
  TabData,
  LocationData,
  StorageData,
  BrowserInfo,
  DeviceInfo,
  NetworkInfo,
} from "./types/events";
import { openDB } from "idb";

/**
 * Optimized Analytics class using modern browser APIs and performance best practices
 */

class TransferableBuffer {
  private buffer: SharedArrayBuffer;
  private view: Int32Array;
  private offset = 0;

  constructor(size: number) {
    this.buffer = new SharedArrayBuffer(size);
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
  private readonly worker: Worker;
  private readonly eventBuffer: TransferableBuffer;
  private readonly sessionId = crypto.randomUUID();
  private currentUserId: string | null = null;

  // Optimized storage
  private readonly eventQueue = new RingBuffer<AnalyticsEventUnion>(1000);
  private readonly idCache = new Int32Array(new SharedArrayBuffer(4000));
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
    this.worker = new Worker(
      new URL("./analytics.worker.ts", import.meta.url),
      { type: "module" }
    );
    this.eventBuffer = new TransferableBuffer(32 * 1024);
    this.initializePrivacySettings();
    this.initialize();
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
    this.setupMediaTracking();
    this.setupResourceTracking();
    this.setupTabTracking();
    this.setupLocationTracking();
    this.setupIdleTracking();
    // this.setupPerformanceMonitoring();

    // Handle page unload
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.flushEvents();
      }
    });
  }

  private setupMediaTracking(): void {
    const mediaEvents = [
      "play",
      "pause",
      "ended",
      "timeupdate",
      "volumechange",
    ];

    const handleMediaEvent = (event: Event): void => {
      const media = event.target as HTMLMediaElement;
      if (!media || !this.shouldTrackEvent(EventTypes.MEDIA)) return;

      const mediaData: MediaData = {
        media_type: media instanceof HTMLVideoElement ? "video" : "audio",
        action: event.type,
        media_url: media.currentSrc,
        playback_time: media.currentTime,
        duration: media.duration,
        title: media.title || null,
      };

      this.queueEvent(EventTypes.MEDIA, mediaData);
    };

    mediaEvents.forEach((event) => {
      document.addEventListener(event, handleMediaEvent, { passive: true });
    });
  }

  private setupIntersectionTracking(): void {
    // Create a single observer for all elements we want to track
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!this.shouldTrackEvent(EventTypes.VISIBILITY)) return;

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

          this.queueEvent(EventTypes.VISIBILITY, visibilityData);
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
    if (element.matches("button, a, form, input, select, textarea"))
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
    if (!this.shouldTrackEvent(EventTypes.VISIBILITY)) return;

    this.queueEvent(EventTypes.VISIBILITY, { state: document.visibilityState });
  };

  private setupResourceTracking(): void {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (this.resourceTimings.has(entry.name)) continue;

        const resourceData: ResourceData = {
          resource_type: entry.entryType,
          url: entry.name,
          duration: entry.duration,
          transfer_size:
            "transferSize" in entry
              ? (entry as PerformanceResourceTiming).transferSize
              : 0,
          compression_ratio: null,
          cache_hit: false,
          priority: "auto",
        };

        this.queueEvent(EventTypes.RESOURCE, resourceData);
        this.resourceTimings.add(entry.name);
      }
    });

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
    if (!this.shouldTrackEvent(EventTypes.TAB)) return;

    const tabData: TabData = {
      tab_id: crypto.randomUUID(),
      tab_title: document.title,
      tab_url: window.location.href,
    };

    this.queueEvent(EventTypes.TAB, tabData);
  }

  private setupLocationTracking(): void {
    const handleLocationChange = (): void => {
      if (!this.shouldTrackEvent(EventTypes.LOCATION)) return;

      const locationData: LocationData = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        country: "",
        region: "",
        city: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      this.queueEvent(EventTypes.LOCATION, locationData);
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

    const handleUserActivity = (): void => {
      if (!this.shouldTrackEvent(EventTypes.IDLE)) return;

      const currentTime = performance.now();
      const idleTime = currentTime - this.lastIdleTime;

      if (idleTime > 30000) {
        const idleData: IdleData = {
          idle_time: idleTime,
          last_interaction: new Date().toISOString(),
          is_idle: true,
        };

        this.queueEvent(EventTypes.IDLE, idleData);
      }

      this.lastIdleTime = currentTime;
    };

    idleEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });
  }

  private handleStorage = (event: StorageEvent): void => {
    if (!this.shouldTrackEvent(EventTypes.STORAGE)) return;

    const storageData: StorageData = {
      storage_type: event.storageArea === localStorage ? "local" : "session",
      key: event.key || "",
      value: event.newValue || "",
    };

    this.queueEvent(EventTypes.STORAGE, storageData);
  };

  private handleScroll = (): void => {
    // Only track scroll events for document level metrics
    if (!this.shouldTrackEvent(EventTypes.SCROLL)) return;

    const scrollData: ScrollData = {
      depth: window.scrollY,
      direction: window.scrollY > this.lastScrollPosition ? "down" : "up",
      max_depth: document.documentElement.scrollHeight - window.innerHeight,
      relative_depth: Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      ),
    };

    this.queueEvent(EventTypes.SCROLL, scrollData);
    this.lastScrollPosition = window.scrollY;
  };

  public logConversion(data: Partial<ConversionData>): void {
    if (!this.shouldTrackEvent(EventTypes.CONVERSION)) return;

    this.queueEvent(EventTypes.CONVERSION, {
      ...data,
      timestamp: new Date().toISOString(),
    } as ConversionData);
  }

  public logError(error: Error): void {
    if (!this.shouldTrackEvent(EventTypes.ERROR)) return;

    const errorData: ErrorData = {
      error_type: error.name,
      message: error.message,
      stack_trace: error.stack || null,
      component: "unknown",
    };

    this.queueEvent(EventTypes.ERROR, errorData);
  }

  private shouldTrackEvent(type: EventTypes): boolean {
    return (
      this.privacySettings.allowedDataTypes.includes(type) &&
      this.privacySettings.cookiePreferences.analytics
    );
  }

  private queueEvent(type: EventTypes, data: unknown): void {
    const event = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: performance.now(),
    };

    this.eventQueue.push(event as any);

    if (this.eventQueue.size >= 50) {
      requestAnimationFrame(() => this.flushEvents());
    }
  }

  private async flushEvents(): Promise<void> {
    const events = this.eventQueue.drain();
    if (!events.length) return;

    const compressed = await this.compressEvents(events);

    if (document.visibilityState === "hidden") {
      navigator.sendBeacon("/analytics", compressed);
      return;
    }

    try {
      await fetch("/analytics", {
        method: "POST",
        body: compressed,
        keepalive: true,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
    } catch {
      await this.storeForRetry(events);
    }
  }

  private async compressEvents(
    events: AnalyticsEventUnion[]
  ): Promise<Uint8Array> {
    const stream = new CompressionStream("gzip");
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    await writer.write(encoder.encode(JSON.stringify(events)));
    await writer.close();

    return new Response(stream.readable)
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer));
  }

  private async storeForRetry(events: AnalyticsEventUnion[]): Promise<void> {
    const db = await openDB("analytics", 1, {
      upgrade(db) {
        db.createObjectStore("failed_events", { keyPath: "timestamp" });
      },
    });

    const tx = db.transaction("failed_events", "readwrite");
    const store = tx.objectStore("failed_events");

    await Promise.all(
      events.map((event) => store.add({ ...event, timestamp: Date.now() }))
    );
  }

  private setupClickTracking(): void {
    // Use event delegation for all click tracking
    document.addEventListener("click", this.handleClick, {
      passive: true,
      capture: true, // Capture phase to ensure we get all clicks
    });

    // Track programmatic clicks
    const originalClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function (this: HTMLElement) {
      originalClick.call(this);
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      this.dispatchEvent(event);
    };
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.shouldTrackEvent(EventTypes.CLICK)) return;

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

    this.queueEvent(EventTypes.CLICK, clickData);
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

  private getElementMetadata(element: Element): Record<string, unknown> {
    return {
      accessibility: {
        role: element.getAttribute("role"),
        label: element.getAttribute("aria-label"),
        description: element.getAttribute("aria-description"),
      },
      interactivity: {
        is_focusable: element.matches(":focusable"),
        is_disabled: element.matches(":disabled"),
        tab_index: element.getAttribute("tabindex"),
      },
    };
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
}

export default Analytics.getInstance();
