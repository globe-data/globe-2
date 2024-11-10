// Types for enhanced analytics
interface UserContext {
  anonymousId: string;
  sessionId: string;
  customerUserId?: string;
  cohorts: string[];
  firstVisitDate: string;
  referrer: string;
}

interface InteractionContext {
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
  };
  path: string;
  section?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  contentTags?: string[] | null;
}

interface BusinessMetrics {
  engagement: {
    timeOnPage: number;
    scrollDepth: number;
    interactionCount: number;
    activeTime: number;
    readingTime?: number;
  };
  content: {
    contentViewed: string[];
    mediaPlayed: string[];
    downloadedFiles: string[];
  };
}

interface PrivacySettings {
  gdprConsent: boolean;
  ccpaCompliance: boolean;
  dataRetentionDays: number;
  allowedDataTypes: string[];
  ipAnonymization: boolean;
}

interface AnalyticsOptions {
  batchSize: number;
  batchInterval: number;
  sampling: number;
  debug: boolean;
  tier: "basic" | "premium" | "enterprise";
  retryAttempts: number;
  retryDelay: number;
  enableML: boolean;
  enableRealTime: boolean;
}

// Core tracking system
class Analytics {
  private static instance: Analytics | null = null;
  private events: any[] = [];
  private interactionCount: number = 0;
  private startTime: number = Date.now();
  private lastActiveTime: number = Date.now();
  private activeTimeTotal: number = 0;
  private userContext!: UserContext;
  private privacySettings!: PrivacySettings;
  private contentHistory: Set<string> = new Set();
  private mediaHistory: Set<string> = new Set();
  private downloadHistory: Set<string> = new Set();

  private options: AnalyticsOptions = {
    batchSize: 50,
    batchInterval: 5000,
    sampling: 1.0,
    debug: false,
    tier: "basic",
    retryAttempts: 3,
    retryDelay: 1000,
    enableML: false,
    enableRealTime: false,
  };

  private pageLoadTime: number = Date.now();
  private maxScrollDepth: number = 0;
  private totalScrollDistance: number = 0;
  private lastScrollPosition: number = 0;
  private clickCoordinates: Array<{ x: number; y: number }> = [];
  private mouseMovements: number = 0;
  private lastMouseMoveTime: number = Date.now();
  private heatmapData: Map<string, number> = new Map();
  private exitIntentCount: number = 0;

  private constructor() {
    this.initializeUserContext();
    this.initializePrivacySettings();
    this.initializeTracking();
    this.setupTracking();
  }

  public static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  private initializeUserContext(): void {
    this.userContext = {
      anonymousId: this.generateAnonymousId(),
      sessionId: this.generateAnonymousId(),
      cohorts: this.assignCohorts(),
      firstVisitDate: this.getFirstVisitDate(),
      referrer: document.referrer,
    };
  }

  private initializePrivacySettings(): void {
    this.privacySettings = {
      gdprConsent: this.checkGDPRConsent(),
      ccpaCompliance: this.checkCCPACompliance(),
      dataRetentionDays: 90,
      allowedDataTypes: [
        "click",
        "scroll_milestone",
        "media_play",
        "download",
        "form_submit",
        "content_view",
        "identify",
        "custom",
      ],
      ipAnonymization: true,
    };
  }

  private setupTracking(): void {
    setInterval(() => this.processBatch(), this.options.batchInterval);
    setInterval(() => this.updateActiveTime(), 1000);
  }

  private generateAnonymousId(): string {
    return crypto.randomUUID();
  }

  private assignCohorts(): string[] {
    return ["default_experience"];
  }

  private getFirstVisitDate(): string {
    const stored = localStorage.getItem("analytics_first_visit");
    if (!stored) {
      const now = new Date().toISOString();
      localStorage.setItem("analytics_first_visit", now);
      return now;
    }
    return stored;
  }

  private checkGDPRConsent(): boolean {
    return true;
  }

  private checkCCPACompliance(): boolean {
    return true;
  }

  private pushEvent(type: string, data: any): void {
    if (!this.shouldTrackEvent(type)) return;
    // if (Math.random() > this.options.sampling) return;

    this.interactionCount++;
    this.lastActiveTime = Date.now();

    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      data,
      context: {
        ...this.getInteractionContext(),
        user: this.userContext,
        metrics: this.getBusinessMetrics(),
      },
    };

    this.events.push(event);
    if (this.options.debug) {
      console.log("Event tracked:", event);
    }

    if (this.options.enableRealTime) {
      this.sendRealTimeEvent(event);
    }

    if (this.events.length >= this.options.batchSize) {
      this.processBatch();
    }
  }

  private shouldTrackEvent(type: string): boolean {
    return this.privacySettings.allowedDataTypes.includes(type);
  }

  private getInteractionContext(): InteractionContext {
    const path = window.location.pathname;
    const contentEl = document.querySelector("[data-content-id]");
    const sectionEl = document.querySelector("[data-section]");

    return {
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      path,
      section: sectionEl?.getAttribute("data-section"),
      contentType: contentEl?.getAttribute("data-content-type"),
      contentId: contentEl?.getAttribute("data-content-id"),
      contentTags: contentEl?.getAttribute("data-tags")?.split(","),
    };
  }

  private getBusinessMetrics(): BusinessMetrics {
    return {
      engagement: {
        timeOnPage: (Date.now() - this.startTime) / 1000,
        scrollDepth: this.calculateScrollDepth(),
        interactionCount: this.interactionCount,
        activeTime: this.activeTimeTotal / 1000,
        readingTime: this.calculateReadingTime(),
      },
      content: {
        contentViewed: Array.from(this.contentHistory),
        mediaPlayed: Array.from(this.mediaHistory),
        downloadedFiles: Array.from(this.downloadHistory),
      },
    };
  }

  private calculateScrollDepth(): number {
    const winHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;
    return Math.round(((scrollTop + winHeight) / docHeight) * 100);
  }

  private calculateReadingTime(): number {
    const content =
      document.querySelector("article, .content")?.textContent || "";
    const wordCount = content.trim().split(/\s+/).length;
    return Math.round(wordCount / 200); // Assuming 200 words per minute reading speed
  }

  private updateActiveTime(): void {
    const now = Date.now();
    if (now - this.lastActiveTime < 30000) {
      // Consider user active if interaction within last 30s
      this.activeTimeTotal += 1000;
    }
  }

  private initializeTracking(): void {
    // Track clicks with enhanced context
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const linkTarget = target.closest("a");
      const buttonTarget = target.closest("button");

      this.pushEvent("click", {
        x: e.clientX,
        y: e.clientY,
        element: this.getElementPath(target),
        text: target.textContent?.trim() || "",
        link: linkTarget
          ? {
              href: linkTarget.href,
              text: linkTarget.textContent?.trim(),
              target: linkTarget.target,
            }
          : undefined,
        button: buttonTarget
          ? {
              type: buttonTarget.type,
              text: buttonTarget.textContent?.trim(),
            }
          : undefined,
      });
    });

    // Track scroll events
    let lastScrollDepth = 0;
    document.addEventListener("scroll", () => {
      const currentDepth = this.calculateScrollDepth();
      if (Math.abs(currentDepth - lastScrollDepth) >= 10) {
        // Track every 10% change
        lastScrollDepth = currentDepth;
        this.pushEvent("scroll_milestone", {
          depth: currentDepth,
          direction: currentDepth > lastScrollDepth ? "down" : "up",
        });
      }
    });

    // Track media interactions
    document.addEventListener(
      "play",
      (e) => {
        const media = e.target as HTMLMediaElement;
        this.mediaHistory.add(media.src);
        this.pushEvent("media_play", {
          type: media instanceof HTMLVideoElement ? "video" : "audio",
          src: media.src,
          duration: media.duration,
          title: media.title || this.getElementPath(media),
        });
      },
      true
    );

    // Track downloads
    document.addEventListener("click", (e) => {
      const link = (e.target as HTMLElement).closest("a");
      if (
        link?.download ||
        (link?.href && /\.(pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(link.href))
      ) {
        this.downloadHistory.add(link.href);
        this.pushEvent("download", {
          url: link.href,
          filename: link.download || link.href.split("/").pop(),
          type: link.href.split(".").pop()?.toLowerCase(),
        });
      }
    });

    // Track form interactions
    document.addEventListener("submit", (e) => {
      const form = e.target as HTMLFormElement;
      this.pushEvent("form_submit", {
        formId: form.id || this.getElementPath(form),
        action: form.action,
        fields: Array.from(form.elements).map((el) => ({
          type: (el as HTMLInputElement).type,
          name: (el as HTMLInputElement).name,
          isValid: (el as HTMLInputElement).validity.valid,
        })),
      });
    });

    // Track content visibility
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target;
          if (entry.isIntersecting && element.hasAttribute("data-content-id")) {
            this.contentHistory.add(
              element.getAttribute("data-content-id") || ""
            );
            this.pushEvent("content_view", {
              contentId: element.getAttribute("data-content-id"),
              contentType: element.getAttribute("data-content-type"),
              visibleTime: entry.time,
              viewportCoverage: entry.intersectionRatio,
            });
          }
        });
      },
      { threshold: [0, 0.5, 1] }
    );

    document
      .querySelectorAll("[data-content-id]")
      .forEach((el) => observer.observe(el));

    // Track maximum scroll depth
    document.addEventListener("scroll", () => {
      const currentDepth = this.calculateScrollDepth();
      this.maxScrollDepth = Math.max(this.maxScrollDepth, currentDepth);

      // Calculate total scroll distance
      const currentPosition = window.scrollY;
      this.totalScrollDistance += Math.abs(
        currentPosition - this.lastScrollPosition
      );
      this.lastScrollPosition = currentPosition;
    });

    // Track mouse movements for engagement
    document.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (now - this.lastMouseMoveTime > 50) {
        // Throttle to every 50ms
        this.mouseMovements++;
        this.lastMouseMoveTime = now;

        // Simple heatmap tracking
        const key = `${Math.floor(e.clientX / 50)},${Math.floor(
          e.clientY / 50
        )}`;
        this.heatmapData.set(key, (this.heatmapData.get(key) || 0) + 1);
      }
    });

    // Track exit intent (moving mouse toward top of page quickly)
    document.addEventListener("mousemove", (e) => {
      if (e.clientY < 50 && e.movementY < -10) {
        this.exitIntentCount++;
        this.track("exit_intent", {
          position: { x: e.clientX, y: e.clientY },
          count: this.exitIntentCount,
        });
      }
    });

    // Track page visibility changes
    document.addEventListener("visibilitychange", () => {
      this.track("visibility_change", {
        isVisible: !document.hidden,
        timestamp: new Date().toISOString(),
      });
    });

    // Track page exit
    window.addEventListener("beforeunload", () => {
      this.sendExitData();
    });

    // Track clicks for heatmap
    document.addEventListener("click", (e) => {
      this.clickCoordinates.push({
        x: e.clientX,
        y: e.clientY,
      });
    });
  }

  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current) {
      let identifier = current.tagName.toLowerCase();
      if (current.id) {
        identifier += `#${current.id}`;
      } else if (current.className) {
        identifier += `.${current.className.split(" ").join(".")}`;
      }
      if (current.getAttribute("data-testid")) {
        identifier += `[data-testid="${current.getAttribute("data-testid")}"]`;
      }
      path.unshift(identifier);
      current = current.parentElement;
    }

    return path.join(" > ");
  }

  // Existing methods for data processing and sending...
  private async compressData(data: any): Promise<Uint8Array> {
    const jsonString = JSON.stringify(data);
    const textEncoder = new TextEncoder();
    const compressed = await new Response(
      new Blob([textEncoder.encode(jsonString)])
        .stream()
        .pipeThrough(new CompressionStream("gzip"))
    ).arrayBuffer();
    return new Uint8Array(compressed);
  }

  private async sendData(data: Uint8Array): Promise<void> {
    const response = await fetch("/api/v1/analytics", {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "gzip",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  private async processBatch(): Promise<void> {
    if (!this.events.length) return;

    const batch = this.events.splice(0, this.options.batchSize);
    let attempts = 0;

    while (attempts < this.options.retryAttempts) {
      try {
        const compressed = await this.compressData(batch);
        await this.sendData(compressed);
        break;
      } catch (error) {
        attempts++;
        if (attempts === this.options.retryAttempts) {
          this.events.unshift(...batch);
          if (this.options.debug) {
            console.error("Failed to process batch after retries:", error);
          }
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay * attempts)
          );
        }
      }
    }
  }

  private async sendRealTimeEvent(event: any): Promise<void> {
    if (!this.options.enableRealTime) return;
    try {
      await fetch("/api/v1/analytics/realtime", {
        method: "POST",
        body: JSON.stringify(event),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Real-time analytics error:", error);
    }
  }

  // Public API methods
  public identify(userId: string, traits?: Record<string, any>): void {
    this.userContext.customerUserId = userId;
    if (traits) {
      this.pushEvent("identify", { userId, traits });
    }
  }

  public track(eventName: string, properties?: Record<string, any>): void {
    this.pushEvent("custom", { eventName, properties });
  }

  public setPrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
  }

  private getEngagementScore(): number {
    const timeOnPage = (Date.now() - this.pageLoadTime) / 1000;
    const scrollScore = this.maxScrollDepth * 0.3;
    const interactionScore = (this.interactionCount / timeOnPage) * 0.3;
    const mouseScore = (this.mouseMovements / timeOnPage) * 0.2;
    const activeTimeScore = (this.activeTimeTotal / (timeOnPage * 1000)) * 0.2;

    return Math.min(
      scrollScore + interactionScore + mouseScore + activeTimeScore,
      1
    );
  }

  private async sendExitData(): Promise<void> {
    const exitData = {
      timestamp: new Date().toISOString(),
      timeOnPage: (Date.now() - this.pageLoadTime) / 1000,
      engagementMetrics: {
        maxScrollDepth: this.maxScrollDepth,
        totalScrollDistance: this.totalScrollDistance,
        interactionCount: this.interactionCount,
        mouseMovements: this.mouseMovements,
        activeTimeSeconds: this.activeTimeTotal / 1000,
        exitIntentCount: this.exitIntentCount,
        engagementScore: this.getEngagementScore(),
        clickCount: this.clickCoordinates.length,
      },
      contentEngagement: {
        contentViewed: Array.from(this.contentHistory),
        mediaPlayed: Array.from(this.mediaHistory),
        downloadedFiles: Array.from(this.downloadHistory),
        readingTime: this.calculateReadingTime(),
      },
      userBehavior: {
        clickHeatmap: this.clickCoordinates,
        mouseHeatmap: Array.from(this.heatmapData.entries()),
        lastViewedSection: this.getLastViewedSection(),
      },
      deviceContext: {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screenSize: {
          width: screen.width,
          height: screen.height,
        },
        devicePixelRatio: window.devicePixelRatio,
        orientation: screen.orientation?.type,
      },
      navigationContext: {
        entryPoint: document.referrer,
        exitUrl: document.activeElement?.closest("a")?.href,
        navigationType: performance.navigation?.type,
      },
    };

    // Use sendBeacon for more reliable delivery during page unload
    const blob = new Blob([JSON.stringify(exitData)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/v1/analytics/exit", blob);

    if (this.options.debug) {
      console.log("Exit data:", exitData);
    }
  }

  private getLastViewedSection(): string | null {
    const sections = document.querySelectorAll(
      "section, article, [data-section]"
    );
    let lastSection: Element | null = null;
    let maxVisibility = 0;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const visibility = this.calculateElementVisibility(rect);
      if (visibility > maxVisibility) {
        maxVisibility = visibility;
        lastSection = section;
      }
    });

    if (!lastSection) {
      return null;
    }

    const sectionAttr = (lastSection as Element).getAttribute("data-section");
    if (sectionAttr) return sectionAttr;

    const sectionId = (lastSection as Element).id;
    if (sectionId) return sectionId;

    const heading = (lastSection as Element).querySelector("h1,h2,h3");
    if (heading?.textContent) return heading.textContent;

    return null;
  }

  private calculateElementVisibility(rect: DOMRect): number {
    const windowHeight = window.innerHeight;
    if (rect.top > windowHeight || rect.bottom < 0) return 0;

    const visibleHeight =
      Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
    return visibleHeight / rect.height;
  }
}

// Initialize analytics
const analytics = Analytics.getInstance();

// Export for use in other modules
export default analytics;
