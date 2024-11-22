import { z } from "zod";
import { EventSchemas, Event, VisibilityState } from "./types/events";
import { createClient } from "@supabase/supabase-js";

declare const SUPABASE_URL: string;
declare const SUPABASE_KEY: string;

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
class Analytics {
  // ------- PRIVATE MEMBERS -------
  // Singleton instance
  private static instance: Analytics | null = null;
  private events: Event[] = [];
  private privacySettings!: PrivacySettings;
  private eventListeners: {
    type: keyof typeof EventSchemas;
    listener: (e: Event) => void;
  }[] = [];
  private throttleTimeout: number | null = null;
  private lastScrollPosition: number = 0;
  private rateLimitMap = new Map<keyof typeof EventSchemas, number>();
  private readonly RATE_LIMIT_MS = 1000; // 1 second between same event types
  private readonly SCROLL_DEBOUNCE_MS = 250;
  private scrollTimeout: number | null = null;
  private readonly API_URL = "http://localhost:8000/api/v1/analytics/batch";
  private readonly supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  private readonly sessionId = crypto.randomUUID();
  private currentUserId: string | null = null;
  private authWindowOpened = false;

  // Private constructor
  private constructor() {
    this.initialize();
  }

  // Public static method to get the singleton instance
  public static getInstance() {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  // Private method to initialize the analytics instance
  private initialize() {
    this.initializeUser();
    this.initializePrivacySettings();
    this.setupTracking();
    this.setupEventListeners();
    this.setupDOMListeners();
    this.setupTestHandlers();
    this.logPageView();
  }

  private async initializeUser() {
    // Check if user has declined tracking this session
    if (sessionStorage.getItem("tracking_declined")) {
      return;
    }

    // Check if auth window was already opened this session
    if (this.authWindowOpened) {
      return;
    }

    // Get initial user state
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      this.authWindowOpened = true;

      // Open auth window
      const authWindow = window.open(
        "globe.data/login?fromExtension=true",
        "_blank"
      );

      // Listen for auth response
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "auth_response") {
          if (event.data.success) {
            this.currentUserId = event.data.userId;
            // Initialize tracking here
          } else {
            // User declined tracking
            sessionStorage.setItem("tracking_declined", "true");
          }
          window.removeEventListener("message", messageHandler);
        }
      };

      window.addEventListener("message", messageHandler);
    } else {
      this.currentUserId = user.id;
      // Initialize tracking here
    }
  }

  // Private method to set up tracking intervals
  private setupTracking() {
    // Set up basic tracking intervals
    setInterval(() => this.processBatch(), 5000);
  }

  // Todo: finalize these
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

  // ------- BASIC SETUP DONE -------

  private pushEvent<T extends keyof typeof EventSchemas>(
    type: T,
    data: z.infer<(typeof EventSchemas)[T]>["data"]
  ): void {
    // Rate limiting check
    const lastEventTime = this.rateLimitMap.get(type);
    const now = Date.now();
    if (lastEventTime && now - lastEventTime < this.RATE_LIMIT_MS) {
      return;
    }
    this.rateLimitMap.set(type, now);

    const baseEvent = {
      globe_id: this.currentUserId || "03c04930-0c1b-4a2a-96cd-933dd8d7914c",
      event_id: crypto.randomUUID(),
      timestamp: new Date(),
      client_timestamp: new Date(),
      session_id: this.sessionId,
      event_type: type,
      data: data,
    } as const;

    const event =
      type === "custom"
        ? { ...baseEvent, name: (data as any).name }
        : (baseEvent as Event);

    // Validate event against schema
    try {
      EventSchemas[type].parse(event);
    } catch (error) {
      console.error(`Invalid event data for type ${type}:`, error);
      return;
    }

    // Prevent buffer overflow
    if (this.events.length >= 1000) {
      this.events.shift(); // Remove oldest event
    }

    this.events.push(event as Event);

    // Process batch if threshold reached
    if (this.events.length >= 50) {
      this.processBatch();
    }
  }

  private async sendToAnalyticsServer(
    events: Event[]
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
      let errorMessage = "Failed to send events to analytics server";
      try {
        const errorData = await response.json();

        // Handle the structured error response from BatchAnalyticsRequest
        if (errorData.detail && typeof errorData.detail === "object") {
          const validationErrors = errorData.detail.errors;
          errorMessage = `Validation errors: ${JSON.stringify(
            validationErrors
          )}`;
        } else {
          errorMessage = errorData.detail || errorMessage;
        }
      } catch {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  private async processBatch(retries = 3): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToProcess = [...this.events];
    this.events = []; // Clear the queue early

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(
          `Processing batch of events (attempt ${attempt + 1}/${retries}):`,
          eventsToProcess
        );
        await this.sendToAnalyticsServer(eventsToProcess);
        return; // Success, exit the function
      } catch (error) {
        console.error(
          `Failed to process events (attempt ${attempt + 1}/${retries}):`,
          error
        );

        if (attempt === retries - 1) {
          // On final failure, add back to queue if space allows
          if (this.events.length + eventsToProcess.length <= 1000) {
            this.events.push(...eventsToProcess);
          }
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
  }

  private shouldTrackEvent(type: keyof typeof EventSchemas): boolean {
    return this.privacySettings.allowedDataTypes.includes(type);
  }

  // ------- Helper Methods -------
  private calculateScrollDepth(): number {
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    return Math.round(((scrollTop + winHeight) / docHeight) * 100);
  }

  // ------- Event Listeners -------

  private setupEventListeners(): void {
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (this.shouldTrackEvent("click")) {
        const clickData: z.infer<(typeof EventSchemas)["click"]>["data"] = {
          element_path: this.getElementPath(target),
          element_text: target.textContent?.trim() || "",
          target: this.getElementData(target),
          page: this.getPageData(),
          x_pos: e.clientX,
          y_pos: e.clientY,
          href: target instanceof HTMLAnchorElement ? target.href : undefined,
        };
        this.pushEvent("click", clickData);
      }
    };

    const scrollHandler = (e: Event) => {
      if (this.scrollTimeout) {
        window.clearTimeout(this.scrollTimeout);
      }

      this.scrollTimeout = window.setTimeout(() => {
        if (this.shouldTrackEvent("scroll")) {
          const currentScroll = window.scrollY;
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          const scrollData: z.infer<(typeof EventSchemas)["scroll"]>["data"] = {
            depth: this.calculateScrollDepth(),
            direction: this.lastScrollPosition < currentScroll ? "down" : "up",
            max_depth: maxScroll,
            relative_depth: Math.round((currentScroll / maxScroll) * 100),
          };
          this.pushEvent("scroll", scrollData);
          this.lastScrollPosition = currentScroll;
        }
      }, this.SCROLL_DEBOUNCE_MS);
    };

    const visibilityHandler = (e: Event) => {
      if (this.shouldTrackEvent("visibility")) {
        const visibilityData: z.infer<
          (typeof EventSchemas)["visibility"]
        >["data"] = {
          visibility_state: document.visibilityState as VisibilityState,
        };
        this.pushEvent("visibility", visibilityData);
      }
    };

    // Store listeners with proper types
    this.eventListeners = [
      {
        type: "click",
        listener: (e: Event) => {
          if (e instanceof MouseEvent) {
            clickHandler(e);
          }
        },
      },
      {
        type: "scroll",
        listener: (e: Event) => scrollHandler(e),
      },
      {
        type: "visibility",
        listener: (e: Event) => visibilityHandler(e),
      },
    ];

    // Add listeners with proper event types
    this.eventListeners.forEach(({ type, listener }) => {
      if (type === "visibility") {
        document.addEventListener("visibilitychange", listener as any);
      } else {
        document.addEventListener(type, listener as any);
      }
    });
  }

  // Add cleanup method
  public cleanup(): void {
    // Clear all timeouts
    if (this.throttleTimeout) {
      window.clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    if (this.scrollTimeout) {
      window.clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    // Remove all event listeners
    this.eventListeners.forEach(({ type, listener }) => {
      if (type === "visibility") {
        document.removeEventListener("visibilitychange", listener as any);
      } else {
        document.removeEventListener(type, listener as any);
      }
    });
    this.eventListeners = [];

    // Clear data structures
    this.events = [];
    this.rateLimitMap.clear();

    // Clear the singleton instance
    Analytics.instance = null;
  }

  public logPageView(): void {
    if (this.shouldTrackEvent("pageview")) {
      const pageViewData: z.infer<(typeof EventSchemas)["pageview"]>["data"] = {
        url: window.location.href,
        referrer: document.referrer || undefined,
        title: document.title,
        path: window.location.pathname,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        load_time: performance.now(),
      };
      this.pushEvent("pageview", pageViewData);
    }
  }

  public logMediaEvent(
    data: z.infer<(typeof EventSchemas)["media"]>["data"]
  ): void {
    if (this.shouldTrackEvent("media")) {
      this.pushEvent("media", data);
    }
  }

  public logFormEvent(
    data: z.infer<(typeof EventSchemas)["form"]>["data"]
  ): void {
    if (this.shouldTrackEvent("form")) {
      this.pushEvent("form", data);
    }
  }

  public logConversionEvent(
    data: z.infer<(typeof EventSchemas)["conversion"]>["data"]
  ): void {
    if (this.shouldTrackEvent("conversion")) {
      this.pushEvent("conversion", data);
    }
  }

  public logErrorEvent(
    data: z.infer<(typeof EventSchemas)["error"]>["data"]
  ): void {
    if (this.shouldTrackEvent("error")) {
      this.pushEvent("error", data);
    }
  }

  public logPerformanceEvent(
    data: z.infer<(typeof EventSchemas)["performance"]>["data"]
  ): void {
    if (this.shouldTrackEvent("performance")) {
      this.pushEvent("performance", data);
    }
  }

  private setupDOMListeners(): void {
    // Form submission tracking
    document.addEventListener("submit", (e) => {
      const form = e.target as HTMLFormElement;
      if (!form || !this.shouldTrackEvent("form")) return;

      const formData: z.infer<(typeof EventSchemas)["form"]>["data"] = {
        form_id: form.id || "unknown",
        action: form.action || "submit",
        fields: this.getFormFields(form),
        success: true,
      };

      this.pushEvent("form", formData);
    });

    // Media tracking (video and audio)
    document.addEventListener(
      "play",
      (e) => {
        const media = e.target as HTMLMediaElement;
        if (!media || !this.shouldTrackEvent("media")) return;

        const mediaData: z.infer<(typeof EventSchemas)["media"]>["data"] = {
          media_type: media instanceof HTMLVideoElement ? "video" : "audio",
          action: "play",
          media_url: media.currentSrc,
          playback_time: media.currentTime,
          duration: media.duration,
          title: media.title || undefined,
        };
        this.pushEvent("media", mediaData);
      },
      true
    );

    // Track all media events
    const mediaEvents = [
      "pause",
      "ended",
      "timeupdate",
      "volumechange",
      "seeking",
    ];
    mediaEvents.forEach((eventType) => {
      document.addEventListener(
        eventType,
        (e) => {
          const media = e.target as HTMLMediaElement;
          if (!media || !this.shouldTrackEvent("media")) return;

          const mediaData: z.infer<(typeof EventSchemas)["media"]>["data"] = {
            media_type: media instanceof HTMLVideoElement ? "video" : "audio",
            action: eventType,
            media_url: media.currentSrc,
            playback_time: media.currentTime,
            duration: media.duration,
            title: media.title || undefined,
          };
          this.pushEvent("media", mediaData);
        },
        true
      );
    });

    // Error tracking
    window.addEventListener("error", (e: ErrorEvent) => {
      if (this.shouldTrackEvent("error")) {
        const errorData: z.infer<(typeof EventSchemas)["error"]>["data"] = {
          error_type: "runtime",
          message: e.message,
          stack_trace: e.error?.stack || "",
          component: e.filename || "unknown",
        };
        this.pushEvent("error", errorData);
      }
    });

    // Performance tracking
    if ("PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (this.shouldTrackEvent("performance")) {
            const perfData: z.infer<
              (typeof EventSchemas)["performance"]
            >["data"] = {
              metric_name: entry.entryType,
              value: entry.duration || entry.startTime,
              navigation_type:
                performance.navigation?.type?.toString() || "unknown",
              effective_connection_type:
                (navigator as any).connection?.effectiveType || "unknown",
            };
            this.pushEvent("performance", perfData);
          }
        });
      });

      // Observe various performance metrics
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

  // Helper method to safely get form fields
  private getFormFields(form: HTMLFormElement): string[] {
    const fields: string[] = [];
    const elements = form.elements;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i] as HTMLInputElement;
      if (element.name && !element.name.toLowerCase().includes("password")) {
        fields.push(element.name);
      }
    }

    return fields;
  }

  // Helper method to get standardized element data
  private getElementData(element: HTMLElement): Record<string, unknown> {
    return {
      tagName: element.tagName?.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      textContent: element.textContent?.trim() || undefined,
      href: element instanceof HTMLAnchorElement ? element.href : undefined,
      type: element instanceof HTMLInputElement ? element.type : undefined,
      name: "name" in element ? element.name : undefined,
      value: "value" in element ? element.value : undefined,
      attributes: this.getCustomAttributes(element),
      path: this.getElementPath(element),
      position: this.getElementPosition(element),
    };
  }

  // Get custom data attributes
  private getCustomAttributes(element: HTMLElement): Record<string, string> {
    const customAttrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-")) {
        customAttrs[attr.name] = attr.value;
      }
    });
    return customAttrs;
  }

  // Get element's DOM path
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

  // Get element's position relative to viewport
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

  // Get standardized page data
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

  // Add this method to the Analytics class
  private setupTestHandlers(): void {
    // Error Test
    const errorButton = document.getElementById("errorButton");
    if (errorButton) {
      errorButton.addEventListener("click", () => {
        try {
          // Deliberately cause an error
          throw new Error("Test error from error button");
        } catch (error) {
          const errorData: z.infer<(typeof EventSchemas)["error"]>["data"] = {
            error_type: "test",
            message: error instanceof Error ? error.message : "Unknown error",
            stack_trace: error instanceof Error ? error.stack || "" : "",
            component: "ErrorButton",
          };
          this.pushEvent("error", errorData);
        }
      });
    }

    // Conversion Test
    const purchaseButton = document.getElementById("purchaseButton");
    if (purchaseButton) {
      purchaseButton.addEventListener("click", () => {
        const conversionData: z.infer<
          (typeof EventSchemas)["conversion"]
        >["data"] = {
          conversion_type: "purchase",
          value: 99.99,
          currency: "USD",
          products: ["test_product"],
        };
        this.pushEvent("conversion", conversionData);
      });
    }

    // Performance Test
    const loadHeavyButton = document.getElementById("loadHeavyContent");
    if (loadHeavyButton) {
      loadHeavyButton.addEventListener("click", async () => {
        const startTime = performance.now();

        // Simulate heavy operation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const perfData: z.infer<(typeof EventSchemas)["performance"]>["data"] =
          {
            metric_name: "heavy_content_load",
            value: performance.now() - startTime,
            navigation_type: "heavy_content",
            effective_connection_type:
              (navigator as any).connection?.effectiveType || "unknown",
          };
        this.pushEvent("performance", perfData);
      });
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
