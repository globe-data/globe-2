class Analytics {
    // Private constructor
    constructor() {
        this.events = [];
        this.initialize();
    }
    // Public static method to get the singleton instance
    static getInstance() {
        if (!Analytics.instance) {
            Analytics.instance = new Analytics();
        }
        return Analytics.instance;
    }
    // Private method to initialize the analytics instance
    initialize() {
        this.setupTracking();
    }
    // Private method to set up tracking intervals
    setupTracking() {
        // Set up basic tracking intervals
        setInterval(() => this.processBatch(), 5000);
    }
    // ------- BASIC SETUP DONE -------
    pushEvent(type, data) {
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
    async processBatch() {
        if (!this.events.length)
            return;
        const batch = this.events.splice(0, 50);
        try {
            await fetch("http://127.0.0.1:3000/api/v1/analytics/batch", {
                method: "POST",
                body: JSON.stringify({ events: batch }),
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }
        catch (error) {
            // On error, put events back in queue
            this.events.unshift(...batch);
        }
    }
    // TRACKING EVENTS:
    clickEvent(data) {
        this.pushEvent("click", data);
    }
}
// ------- PRIVATE MEMBERS -------
// Singleton instance
Analytics.instance = null;
// Initialize analytics
const analytics = Analytics.getInstance();
export default analytics;
