class Analytics {
    // Private constructor
    constructor() {
        this.events = [];
        this.eventListeners = [];
        this.throttleTimeout = null;
        this.lastScrollPosition = 0;
        this.rateLimitMap = new Map();
        this.RATE_LIMIT_MS = 1000; // 1 second between same event types
        this.SCROLL_DEBOUNCE_MS = 250;
        this.scrollTimeout = null;
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
        this.initializePrivacySettings();
        this.setupTracking();
        this.setupEventListeners();
        this.setupDOMListeners();
        this.setupTestHandlers();
        this.logPageView();
    }
    // Private method to set up tracking intervals
    setupTracking() {
        // Set up basic tracking intervals
        setInterval(() => this.processBatch(), 5000);
    }
    initializePrivacySettings() {
        this.privacySettings = {
            gdprConsent: true,
            ccpaCompliance: true,
            dataRetentionDays: 90,
            allowedDataTypes: [
                "click",
                "scroll",
                "visibility",
                "pageview",
                "media",
                "form",
                "conversion",
                "error",
                "performance",
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
    pushEvent(type, data) {
        // Rate limiting check
        const lastEventTime = this.rateLimitMap.get(type);
        const now = Date.now();
        if (lastEventTime && now - lastEventTime < this.RATE_LIMIT_MS) {
            return; // Skip if too frequent
        }
        this.rateLimitMap.set(type, now);
        const event = {
            type,
            data,
            timestamp: new Date(),
            event_id: crypto.randomUUID(),
        };
        // Prevent buffer overflow
        if (this.events.length >= 1000) {
            this.events.shift(); // Remove oldest event
        }
        this.events.push(event);
        // Process batch if threshold reached
        if (this.events.length >= 50) {
            this.processBatch();
        }
    }
    async processBatch() {
        if (this.events.length === 0)
            return;
        const eventsToProcess = [...this.events];
        this.events = []; // Clear the queue early
        try {
            console.log("Processing batch of events:", eventsToProcess);
            // Here you would typically send to your analytics backend
            // Add retry logic for failed requests
            // await this.sendToAnalyticsServer(eventsToProcess);
        }
        catch (error) {
            console.error("Failed to process events:", error);
            // On failure, add back to queue if space allows
            if (this.events.length + eventsToProcess.length <= 1000) {
                this.events.push(...eventsToProcess);
            }
        }
    }
    shouldTrackEvent(type) {
        return this.privacySettings.allowedDataTypes.includes(type);
    }
    // ------- Helper Methods -------
    calculateScrollDepth() {
        const winHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        return Math.round(((scrollTop + winHeight) / docHeight) * 100);
    }
    // ------- Event Listeners -------
    setupEventListeners() {
        const clickHandler = (e) => {
            const target = e.target;
            if (!target)
                return;
            const isInteractiveElement = target.matches(`
        a[href], 
        button, 
        input[type="submit"],
        input[type="button"],
        input[type="radio"],
        input[type="checkbox"],
        select,
        video, 
        audio,
        [role="button"],
        [role="link"],
        [role="tab"],
        [role="menuitem"],
        [onclick],
        [data-analytics-click]
      `);
            if (!isInteractiveElement && this.shouldTrackEvent("click")) {
                const clickData = {
                    x: e.clientX,
                    y: e.clientY,
                    target: this.getElementData(target),
                    page: this.getPageData(),
                };
                this.pushEvent("click", clickData);
            }
        };
        const scrollHandler = (e) => {
            if (this.scrollTimeout) {
                window.clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = window.setTimeout(() => {
                if (this.shouldTrackEvent("scroll")) {
                    const currentScroll = window.scrollY;
                    // Only track significant scroll changes
                    if (Math.abs(this.lastScrollPosition - currentScroll) > 50) {
                        const scrollData = {
                            depth: this.calculateScrollDepth(),
                            direction: this.lastScrollPosition < currentScroll ? "down" : "up",
                            position: currentScroll,
                        };
                        this.pushEvent("scroll", scrollData);
                        this.lastScrollPosition = currentScroll;
                    }
                }
            }, this.SCROLL_DEBOUNCE_MS);
        };
        const visibilityHandler = (e) => {
            if (this.shouldTrackEvent("visibility")) {
                const visibilityData = {
                    state: document.visibilityState,
                    timeOnPage: performance.now(),
                };
                this.pushEvent("visibility", visibilityData);
            }
        };
        // Store listeners with proper types
        this.eventListeners = [
            {
                type: "click",
                listener: (e) => {
                    if (e instanceof MouseEvent) {
                        clickHandler(e);
                    }
                },
            },
            {
                type: "scroll",
                listener: (e) => scrollHandler(e),
            },
            {
                type: "visibility",
                listener: (e) => visibilityHandler(e),
            },
        ];
        // Add listeners with proper event types
        this.eventListeners.forEach(({ type, listener }) => {
            if (type === "visibility") {
                document.addEventListener("visibilitychange", listener);
            }
            else {
                document.addEventListener(type, listener);
            }
        });
    }
    // Add cleanup method
    cleanup() {
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
                document.removeEventListener("visibilitychange", listener);
            }
            else {
                document.removeEventListener(type, listener);
            }
        });
        this.eventListeners = [];
        // Clear data structures
        this.events = [];
        this.rateLimitMap.clear();
        // Clear the singleton instance
        Analytics.instance = null;
    }
    logPageView() {
        if (this.shouldTrackEvent("pageview")) {
            const pageViewData = {
                url: window.location.href,
                referrer: document.referrer,
                title: document.title,
                loadTime: performance.now(),
                deviceInfo: {
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                    },
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                },
            };
            this.pushEvent("pageview", pageViewData);
        }
    }
    logMediaEvent(data) {
        if (this.shouldTrackEvent("media")) {
            this.pushEvent("media", data);
        }
    }
    logFormEvent(data) {
        if (this.shouldTrackEvent("form")) {
            this.pushEvent("form", data);
        }
    }
    logConversionEvent(data) {
        if (this.shouldTrackEvent("conversion")) {
            this.pushEvent("conversion", data);
        }
    }
    logErrorEvent(data) {
        if (this.shouldTrackEvent("error")) {
            this.pushEvent("error", data);
        }
    }
    logPerformanceEvent(data) {
        if (this.shouldTrackEvent("performance")) {
            this.pushEvent("performance", data);
        }
    }
    setupDOMListeners() {
        // Form submission tracking
        document.addEventListener("submit", (e) => {
            const form = e.target;
            if (!form || !this.shouldTrackEvent("form"))
                return;
            const formData = {
                formId: form.id || undefined,
                action: form.action || undefined,
                method: form.method || undefined,
                fields: this.getFormFields(form),
                success: true, // This should be updated based on form validation/submission
            };
            this.logFormEvent({
                formId: form.id || "unknown",
                action: "submit",
                fields: formData.fields,
                success: true,
            });
        });
        // Media tracking (video and audio)
        document.addEventListener("play", (e) => {
            const media = e.target;
            if (!media || !this.shouldTrackEvent("media"))
                return;
            this.logMediaEvent({
                mediaType: media instanceof HTMLVideoElement ? "video" : "audio",
                action: "play",
                mediaUrl: media.currentSrc,
                currentTime: media.currentTime,
                duration: media.duration,
                title: media.title || undefined,
            });
        }, true);
        // Track all media events
        const mediaEvents = [
            "pause",
            "ended",
            "timeupdate",
            "volumechange",
            "seeking",
        ];
        mediaEvents.forEach((eventType) => {
            document.addEventListener(eventType, (e) => {
                const media = e.target;
                if (!media || !this.shouldTrackEvent("media"))
                    return;
                this.logMediaEvent({
                    mediaType: media instanceof HTMLVideoElement ? "video" : "audio",
                    action: eventType,
                    mediaUrl: media.currentSrc,
                    currentTime: media.currentTime,
                    duration: media.duration,
                    title: media.title || undefined,
                });
            }, true);
        });
        // Error tracking
        window.addEventListener("error", (e) => {
            this.logErrorEvent({
                errorType: "runtime",
                message: e.message,
                stackTrace: e.error?.stack,
                component: e.filename,
                severity: "high",
            });
        });
        // Performance tracking
        if ("PerformanceObserver" in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.logPerformanceEvent({
                        metricName: entry.entryType,
                        value: entry.duration || entry.startTime,
                        navigationType: performance.navigation?.type?.toString(),
                        effectiveConnectionType: navigator.connection
                            ?.effectiveType,
                        metric: entry,
                    });
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
            }
            catch (e) {
                console.warn("Some performance metrics not supported");
            }
        }
    }
    // Helper method to safely get form fields
    getFormFields(form) {
        const fields = [];
        const elements = form.elements;
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element.name && !element.name.toLowerCase().includes("password")) {
                fields.push(element.name);
            }
        }
        return fields;
    }
    // Helper method to get standardized element data
    getElementData(element) {
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
    getCustomAttributes(element) {
        const customAttrs = {};
        Array.from(element.attributes).forEach((attr) => {
            if (attr.name.startsWith("data-")) {
                customAttrs[attr.name] = attr.value;
            }
        });
        return customAttrs;
    }
    // Get element's DOM path
    getElementPath(element) {
        const path = [];
        let currentElement = element;
        while (currentElement && currentElement !== document.documentElement) {
            let selector = currentElement.tagName.toLowerCase();
            if (currentElement.id) {
                selector += `#${currentElement.id}`;
            }
            else if (currentElement.className) {
                selector += `.${currentElement.className.split(" ").join(".")}`;
            }
            path.unshift(selector);
            currentElement = currentElement.parentElement;
        }
        return path.join(" > ");
    }
    // Get element's position relative to viewport
    getElementPosition(element) {
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
    getPageData() {
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
    setupTestHandlers() {
        // Error Test
        const errorButton = document.getElementById("errorButton");
        if (errorButton) {
            errorButton.addEventListener("click", () => {
                try {
                    // Deliberately cause an error
                    throw new Error("Test error from error button");
                }
                catch (error) {
                    this.logErrorEvent({
                        errorType: "test",
                        message: error instanceof Error ? error.message : "Unknown error",
                        stackTrace: error instanceof Error ? error.stack : undefined,
                        component: "ErrorButton",
                        severity: "medium",
                    });
                }
            });
        }
        // Conversion Test
        const purchaseButton = document.getElementById("purchaseButton");
        if (purchaseButton) {
            purchaseButton.addEventListener("click", () => {
                this.logConversionEvent({
                    conversionType: "purchase",
                    value: 99.99,
                    currency: "USD",
                    products: ["test_product"],
                    transactionId: `TEST-${Date.now()}`,
                });
            });
        }
        // Performance Test
        const loadHeavyButton = document.getElementById("loadHeavyContent");
        if (loadHeavyButton) {
            loadHeavyButton.addEventListener("click", async () => {
                const startTime = performance.now();
                // Simulate heavy operation
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.logPerformanceEvent({
                    metricName: "heavy_content_load",
                    value: performance.now() - startTime,
                    navigationType: "heavy_content",
                    effectiveConnectionType: navigator.connection?.effectiveType,
                    metric: {
                        name: "heavy_content_load",
                        entryType: "measure",
                        startTime: startTime,
                        duration: performance.now() - startTime,
                        toJSON: () => ({}),
                    },
                });
            });
        }
    }
}
// ------- PRIVATE MEMBERS -------
// Singleton instance
Analytics.instance = null;
// Initialize analytics
const analytics = Analytics.getInstance();
// Log initial pageview when the script loads
window.addEventListener("load", () => {
    analytics.logPageView();
});
export default analytics;
