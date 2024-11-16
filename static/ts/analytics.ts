// Add this interface before the class
interface AnalyticsEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  event_id: string;
}

class Analytics {
  // ------- PRIVATE MEMBERS -------

  // Singleton instance
  private static instance: Analytics | null = null;
  private events: AnalyticsEvent[] = [];

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
    this.setupTracking();
  }

  // Private method to set up tracking intervals
  private setupTracking() {
    // Set up basic tracking intervals
    setInterval(() => this.processBatch(), 5000);
  }

  // ------- BASIC SETUP DONE -------

  private pushEvent(type: string, data: Record<string, unknown>) {
    this.events.push({
      type,
      data,
      timestamp: new Date(),
      event_id: crypto.randomUUID(),
    });

    if (this.events.length >= 50) {
      this.processBatch();
    }
  }

  private async processBatch() {
    if (!this.events.length) return;

    const batch = this.events.splice(0, 50);

    try {
      await fetch("http://127.0.0.1:3000/api/v1/analytics/batch", {
        method: "POST",
        body: JSON.stringify({ events: batch }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // On error, put events back in queue
      this.events.unshift(...batch);
    }
  }

  // TRACKING EVENTS:

  public clickEvent(data: any) {
    this.pushEvent("click", data);
  }
}

// Initialize analytics
const analytics = Analytics.getInstance();

export default analytics;
