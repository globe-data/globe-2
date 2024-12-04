import { z } from "zod";
import { EventSchemas, VisibilityState, AnalyticsEvent } from "./types/events";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

declare const SUPABASE_URL: string;
declare const SUPABASE_KEY: string;

// Types and Interfaces
interface PrivacySettings {
  gdprConsent: boolean;
  ccpaCompliance: boolean;
  dataRetentionDays: number;
  allowedDataTypes: Array<keyof typeof EventSchemas>;
  ipAnonymization: boolean;
  sensitiveDataFields: string[];
  cookiePreferences: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    advertising: boolean;
  };
}

/**
 * Analytics class implementing the Singleton pattern for tracking user interactions
 * and behavior on the website. Handles event collection, validation, and submission
 * to analytics servers.
 */
class Analytics {
  // Constants
  private readonly RATE_LIMIT_MS = 1000;
  private readonly SCROLL_DEBOUNCE_MS = 250;
  private readonly API_URL = "http://localhost:8000/api/v1/analytics/batch";
  private readonly MAX_EVENTS_BUFFER = 1000;
  private readonly MAX_EVENT_IDS = 1000;
  private readonly BATCH_THRESHOLD = 50;

  // Singleton instance
  private static instance: Analytics | null = null;

  // State management
  private events: AnalyticsEvent[] = [];
  private privacySettings!: PrivacySettings;
  private eventListeners: Array<{
    type: keyof typeof EventSchemas;
    listener: EventListener;
  }> = [
    {
      type: "click",
      listener: ((e: Event) =>
        this.handleClick(e as MouseEvent)) as EventListener,
    },
    { type: "scroll", listener: this.handleScroll.bind(this) },
    { type: "visibility", listener: this.handleVisibility.bind(this) },
  ];
  private rateLimitMap = new Map<keyof typeof EventSchemas, number>();
  private usedEventIds: Set<string> = new Set();

  // Session and user management
  private readonly sessionId = crypto.randomUUID();
  private currentUserId: string | null = null;
  private authWindowOpened = false;

  // UI state
  private lastScrollPosition = 0;
  private throttleTimeout: number | null = null;
  private scrollTimeout: number | null = null;

  // Services
  private readonly supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  // Private constructor for singleton pattern
  private constructor() {
    this.initialize();
  }

  /**
   * Gets the singleton instance of the Analytics class
   */
  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  // -------- Initialization Methods --------

  /**
   * Initializes the analytics instance with all necessary setup
   */
  private initialize(): void {
    this.initializeUser();
    this.initializePrivacySettings();
    this.setupTracking();
    this.setupEventListeners();
    this.setupDOMListeners();
    this.setupTestHandlers();
    this.logPageView();
  }

  /**
   * Initializes user authentication and tracking consent
   */
  private async initializeUser(): Promise<void> {
    if (sessionStorage.getItem("tracking_declined") || this.authWindowOpened) {
      return;
    }

    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      this.authWindowOpened = true;
      const authWindow = window.open(
        "globe.data/login?fromExtension=true",
        "_blank"
      );

      window.addEventListener("message", this.handleAuthResponse);
    } else {
      this.currentUserId = user.id;
    }
  }

  /**
   * Handles authentication response from popup window
   */
  private handleAuthResponse = (event: MessageEvent): void => {
    if (event.data?.type === "auth_response") {
      if (event.data.success) {
        this.currentUserId = event.data.userId;
      } else {
        sessionStorage.setItem("tracking_declined", "true");
      }
      window.removeEventListener("message", this.handleAuthResponse);
    }
  };

  /**
   * Initializes privacy settings with default values
   */
  private initializePrivacySettings(): void {
    this.privacySettings = {
      gdprConsent: true,
      ccpaCompliance: true,
      dataRetentionDays: 90,
      allowedDataTypes: [
        "pageview",
        "click",
        "scroll",
        "media",
        "form",
        "conversion",
        "error",
        "performance",
        "visibility",
        "custom",
      ],
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

  // -------- Event Processing Methods --------

  /**
   * Pushes a new event to the queue with rate limiting and validation
   */
  private pushEvent<T extends keyof typeof EventSchemas>(
    type: T,
    data: z.infer<(typeof EventSchemas)[T]>["data"]
  ): void {
    if (!this.shouldTrackEvent(type) || this.isRateLimited(type)) {
      return;
    }

    const event = this.createEvent(type, data);
    if (!this.validateEvent(type, event)) {
      return;
    }

    this.addEventToQueue(event);
  }

  /**
   * Creates a new event with base properties
   */
  private createEvent<T extends keyof typeof EventSchemas>(
    type: T,
    data: z.infer<(typeof EventSchemas)[T]>["data"]
  ): AnalyticsEvent {
    const baseEvent = {
      ...this.createBaseEvent(type),
      data,
    } as const;

    return type === "custom"
      ? ({
          ...baseEvent,
          name: (data as any).name,
          event_type: type,
        } as AnalyticsEvent)
      : ({ ...baseEvent, event_type: type } as AnalyticsEvent);
  }

  /**
   * Creates base event properties
   */
  private createBaseEvent(type: keyof typeof EventSchemas) {
    return {
      globe_id: this.currentUserId || "03c04930-0c1b-4a2a-96cd-933dd8d7914c",
      event_id: this.generateUniqueEventId(),
      timestamp: new Date(),
      client_timestamp: new Date(),
      session_id: this.sessionId,
      event_type: type,
    };
  }

  /**
   * Validates an event against its schema
   */
  private validateEvent<T extends keyof typeof EventSchemas>(
    type: T,
    event: AnalyticsEvent
  ): boolean {
    try {
      EventSchemas[type].parse(event);
      return true;
    } catch (error) {
      console.error(`Invalid event data for type ${type}:`, error);
      return false;
    }
  }

  /**
   * Adds an event to the queue and triggers processing if threshold is reached
   */
  private addEventToQueue(event: AnalyticsEvent): void {
    if (this.events.length >= this.MAX_EVENTS_BUFFER) {
      this.events.shift();
    }

    this.events.push(event);

    if (this.events.length >= this.BATCH_THRESHOLD) {
      this.processBatch();
    }
  }

  // -------- Batch Processing Methods --------

  /**
   * Sets up periodic batch processing
   */
  private setupTracking(): void {
    setInterval(() => this.processBatch(), 5000);
  }

  /**
   * Processes a batch of events with retry logic
   */
  private async processBatch(retries = 3): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToProcess = [...this.events];
    this.events = [];

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.sendToAnalyticsServer(eventsToProcess);
        return;
      } catch (error) {
        console.error(
          `Failed to process events (attempt ${attempt + 1}/${retries}):`,
          error
        );

        if (
          attempt === retries - 1 &&
          this.events.length + eventsToProcess.length <= this.MAX_EVENTS_BUFFER
        ) {
          this.events.push(...eventsToProcess);
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
  }

  /**
   * Sends events to the analytics server
   */
  private async sendToAnalyticsServer(
    events: AnalyticsEvent[]
  ): Promise<Record<string, unknown>> {
    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        events,
        user_id: this.currentUserId,
      }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }

    this.cleanupOldEventIds();
    return await response.json();
  }

  /**
   * Extracts error message from response
   */
  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const errorData = await response.json();
      if (errorData.detail && typeof errorData.detail === "object") {
        return `Validation errors: ${JSON.stringify(errorData.detail.errors)}`;
      }
      return errorData.detail || "Failed to send events to analytics server";
    } catch {
      return `Failed to send events to analytics server: ${response.statusText}`;
    }
  }

  // -------- Utility Methods --------

  /**
   * Generates a unique event ID
   */
  private generateUniqueEventId(): string {
    let eventId: string;
    do {
      eventId = uuidv4();
    } while (this.usedEventIds.has(eventId));

    this.usedEventIds.add(eventId);
    return eventId;
  }

  /**
   * Cleans up old event IDs to prevent memory issues
   */
  private cleanupOldEventIds(): void {
    if (this.usedEventIds.size > this.MAX_EVENT_IDS) {
      const idsArray = Array.from(this.usedEventIds);
      this.usedEventIds = new Set(idsArray.slice(-this.MAX_EVENT_IDS));
    }
  }

  /**
   * Checks if an event type should be tracked based on privacy settings
   */
  private shouldTrackEvent(type: keyof typeof EventSchemas): boolean {
    return this.privacySettings.allowedDataTypes.includes(type);
  }

  /**
   * Checks if an event type is rate limited
   */
  private isRateLimited(type: keyof typeof EventSchemas): boolean {
    const lastEventTime = this.rateLimitMap.get(type);
    const now = Date.now();

    if (lastEventTime && now - lastEventTime < this.RATE_LIMIT_MS) {
      return true;
    }

    this.rateLimitMap.set(type, now);
    return false;
  }

  // -------- Event Listener Setup --------

  /**
   * Sets up core event listeners
   */
  private setupEventListeners(): void {
    this.eventListeners = [
      {
        type: "click",
        listener: (e: Event) => this.handleClick(e as MouseEvent),
      },
      { type: "scroll", listener: this.handleScroll.bind(this) },
      { type: "visibility", listener: this.handleVisibility.bind(this) },
    ];

    this.eventListeners.forEach(({ type, listener }) => {
      if (type === "visibility") {
        document.addEventListener("visibilitychange", listener);
      } else {
        document.addEventListener(type, listener);
      }
    });
  }

  /**
   * Sets up DOM-based event listeners
   */
  private setupDOMListeners(): void {
    document.addEventListener("submit", this.handleFormSubmit.bind(this));
    this.setupMediaListeners();
    window.addEventListener("error", this.handleError.bind(this));
    this.setupPerformanceObserver();
  }

  // -------- Event Handlers --------

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target || !this.shouldTrackEvent("click")) return;

    this.pushEvent("click", {
      element_path: this.getElementPath(target),
      element_text: target.textContent?.trim() || "",
      target: this.getElementData(target),
      page: this.getPageData(),
      x_pos: e.clientX,
      y_pos: e.clientY,
      href: target instanceof HTMLAnchorElement ? target.href : undefined,
    });
  }

  private handleScroll(e: Event): void {
    if (this.scrollTimeout) {
      window.clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = window.setTimeout(() => {
      if (!this.shouldTrackEvent("scroll")) return;

      const currentScroll = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      this.pushEvent("scroll", {
        depth: this.calculateScrollDepth(),
        direction: this.lastScrollPosition < currentScroll ? "down" : "up",
        max_depth: maxScroll,
        relative_depth: Math.round((currentScroll / maxScroll) * 100),
      });

      this.lastScrollPosition = currentScroll;
    }, this.SCROLL_DEBOUNCE_MS);
  }

  private handleVisibility(e: Event): void {
    if (!this.shouldTrackEvent("visibility")) return;

    this.pushEvent("visibility", {
      visibility_state: document.visibilityState as VisibilityState,
    });
  }

  private handleFormSubmit(e: SubmitEvent): void {
    const form = e.target as HTMLFormElement;
    if (!form || !this.shouldTrackEvent("form")) return;

    this.pushEvent("form", {
      form_id: form.id || "unknown",
      action: form.action || "submit",
      fields: this.getFormFields(form),
      success: true,
    });
  }

  private handleError(e: ErrorEvent): void {
    if (!this.shouldTrackEvent("error")) return;

    this.pushEvent("error", {
      error_type: "runtime",
      message: e.message,
      stack_trace: e.error?.stack || "",
      component: e.filename || "unknown",
    });
  }

  // -------- Helper Methods --------

  private calculateScrollDepth(): number {
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    return Math.round(((scrollTop + winHeight) / docHeight) * 100);
  }

  private getFormFields(form: HTMLFormElement): string[] {
    return Array.from(form.elements)
      .filter(
        (element): element is HTMLInputElement =>
          element instanceof HTMLInputElement &&
          Boolean(element.name) &&
          !element.name.toLowerCase().includes("password")
      )
      .map((element) => element.name);
  }

  private getElementData(element: HTMLElement): Record<string, unknown> {
    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      textContent: element.textContent?.trim() || undefined,
      href: element instanceof HTMLAnchorElement ? element.href : undefined,
      type: element instanceof HTMLInputElement ? element.type : undefined,
      name: "name" in element ? (element as any).name : undefined,
      value: "value" in element ? (element as any).value : undefined,
      attributes: this.getCustomAttributes(element),
      path: this.getElementPath(element),
      position: this.getElementPosition(element),
    };
  }

  private getCustomAttributes(element: HTMLElement): Record<string, string> {
    return Array.from(element.attributes)
      .filter((attr) => attr.name.startsWith("data-"))
      .reduce((acc, attr) => ({ ...acc, [attr.name]: attr.value }), {});
  }

  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let currentElement: HTMLElement | null = element;

    while (currentElement && currentElement !== document.documentElement) {
      let selector = currentElement.tagName.toLowerCase();
      if (currentElement.id) {
        selector += `#${currentElement.id}`;
      } else if (currentElement.className) {
        selector += `.${currentElement.className.split(" ").join(".")}`;
      }
      path.unshift(selector);
      currentElement = currentElement.parentElement;
    }

    return path.join(" > ");
  }

  private getElementPosition(element: HTMLElement): Record<string, number> {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    };
  }

  private getPageData(): Record<string, unknown> {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      timestamp: new Date(),
    };
  }

  // -------- Public Methods --------

  /**
   * Logs a page view event
   */
  public logPageView(): void {
    if (this.shouldTrackEvent("pageview")) {
      this.pushEvent("pageview", {
        url: window.location.href,
        referrer: document.referrer || undefined,
        title: document.title,
        path: window.location.pathname,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        load_time: performance.now(),
      });
    }
  }

  /**
   * Logs a media event
   */
  public logMediaEvent(
    data: z.infer<(typeof EventSchemas)["media"]>["data"]
  ): void {
    if (this.shouldTrackEvent("media")) {
      this.pushEvent("media", data);
    }
  }

  /**
   * Logs a form event
   */
  public logFormEvent(
    data: z.infer<(typeof EventSchemas)["form"]>["data"]
  ): void {
    if (this.shouldTrackEvent("form")) {
      this.pushEvent("form", data);
    }
  }

  /**
   * Logs a conversion event
   */
  public logConversionEvent(
    data: z.infer<(typeof EventSchemas)["conversion"]>["data"]
  ): void {
    if (this.shouldTrackEvent("conversion")) {
      this.pushEvent("conversion", data);
    }
  }

  /**
   * Logs an error event
   */
  public logErrorEvent(
    data: z.infer<(typeof EventSchemas)["error"]>["data"]
  ): void {
    if (this.shouldTrackEvent("error")) {
      this.pushEvent("error", data);
    }
  }

  /**
   * Logs a performance event
   */
  public logPerformanceEvent(
    data: z.infer<(typeof EventSchemas)["performance"]>["data"]
  ): void {
    if (this.shouldTrackEvent("performance")) {
      this.pushEvent("performance", data);
    }
  }

  /**
   * Cleans up resources and removes event listeners
   */
  public cleanup(): void {
    if (this.throttleTimeout) {
      window.clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    if (this.scrollTimeout) {
      window.clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    this.eventListeners.forEach(({ type, listener }) => {
      if (type === "visibility") {
        document.removeEventListener("visibilitychange", listener);
      } else {
        document.removeEventListener(type, listener);
      }
    });

    this.events = [];
    this.rateLimitMap.clear();
    this.usedEventIds.clear();
    Analytics.instance = null;
  }

  // -------- Test Handlers --------

  private setupTestHandlers(): void {
    const errorButton = document.getElementById("errorButton");
    if (errorButton) {
      errorButton.addEventListener("click", this.handleTestError.bind(this));
    }

    const purchaseButton = document.getElementById("purchaseButton");
    if (purchaseButton) {
      purchaseButton.addEventListener(
        "click",
        this.handleTestPurchase.bind(this)
      );
    }

    const loadHeavyButton = document.getElementById("loadHeavyContent");
    if (loadHeavyButton) {
      loadHeavyButton.addEventListener(
        "click",
        this.handleTestPerformance.bind(this)
      );
    }
  }

  private handleTestError(): void {
    try {
      throw new Error("Test error from error button");
    } catch (error) {
      this.logErrorEvent({
        error_type: "test",
        message: error instanceof Error ? error.message : "Unknown error",
        stack_trace: error instanceof Error ? error.stack || "" : "",
        component: "ErrorButton",
      });
    }
  }

  private handleTestPurchase(): void {
    this.logConversionEvent({
      conversion_type: "purchase",
      value: 99.99,
      currency: "USD",
      products: ["test_product"],
    });
  }

  private async handleTestPerformance(): Promise<void> {
    const startTime = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logPerformanceEvent({
      metric_name: "heavy_content_load",
      value: performance.now() - startTime,
      navigation_type: "heavy_content",
      effective_connection_type:
        (navigator as any).connection?.effectiveType || "unknown",
    });
  }

  private setupMediaListeners(): void {
    const mediaEvents = [
      "play",
      "pause",
      "ended",
      "timeupdate",
      "volumechange",
      "seeking",
    ];

    mediaEvents.forEach((eventType) => {
      document.addEventListener(
        eventType as keyof DocumentEventMap,
        (e: Event) => {
          const media = e.target as HTMLMediaElement;
          if (!media || !this.shouldTrackEvent("media")) return;

          this.pushEvent("media", {
            media_type: media instanceof HTMLVideoElement ? "video" : "audio",
            action: eventType,
            media_url: media.currentSrc,
            playback_time: media.currentTime,
            duration: media.duration,
            title: media.title || undefined,
          });
        }
      );
    });
  }

  private setupPerformanceObserver(): void {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!this.shouldTrackEvent("performance")) return;

        this.pushEvent("performance", {
          metric_name: entry.entryType,
          value: entry.duration || entry.startTime,
          navigation_type:
            performance.navigation?.type?.toString() || "unknown",
          effective_connection_type:
            (navigator as any).connection?.effectiveType || "unknown",
        });
      });
    });

    try {
      observer.observe({
        entryTypes: [
          "navigation",
          "resource",
          "paint",
          "largest-contentful-paint",
          "first-input",
          "layout-shift",
        ],
      });
    } catch (e) {
      console.warn("Some performance metrics not supported");
    }
  }
}

// Initialize analytics
const analytics = Analytics.getInstance();

// Log initial pageview when the script loads
window.addEventListener("load", () => {
  analytics.logPageView();
});

export default analytics;
