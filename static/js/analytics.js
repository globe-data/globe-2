const API_URL = "http://127.0.0.1:3000";
// Core tracking system
class Analytics {
    constructor() {
        this.events = [];
        this.interactionCount = 0;
        this.startTime = Date.now();
        this.lastActiveTime = Date.now();
        this.activeTimeTotal = 0;
        this.contentHistory = new Set();
        this.mediaHistory = new Set();
        this.downloadHistory = new Set();
        this.options = {
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
        this.pageLoadTime = Date.now();
        this.maxScrollDepth = 0;
        this.totalScrollDistance = 0;
        this.lastScrollPosition = 0;
        this.clickCoordinates = [];
        this.mouseMovements = 0;
        this.lastMouseMoveTime = Date.now();
        this.heatmapData = new Map();
        this.exitIntentCount = 0;
        this.initializeUserContext();
        this.initializePrivacySettings();
        this.initializeTracking();
        this.setupTracking();
    }
    static getInstance() {
        if (!Analytics.instance) {
            Analytics.instance = new Analytics();
        }
        return Analytics.instance;
    }
    initializeUserContext() {
        this.userContext = {
            anonymousId: this.generateAnonymousId(),
            sessionId: this.generateAnonymousId(),
            cohorts: this.assignCohorts(),
            firstVisitDate: this.getFirstVisitDate(),
            referrer: document.referrer,
        };
    }
    initializePrivacySettings() {
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
    setupTracking() {
        setInterval(() => this.processBatch(), this.options.batchInterval);
        setInterval(() => this.updateActiveTime(), 1000);
    }
    generateAnonymousId() {
        return crypto.randomUUID();
    }
    assignCohorts() {
        return ["default_experience"];
    }
    getFirstVisitDate() {
        const stored = localStorage.getItem("analytics_first_visit");
        if (!stored) {
            const now = new Date().toISOString();
            localStorage.setItem("analytics_first_visit", now);
            return now;
        }
        return stored;
    }
    checkGDPRConsent() {
        return true;
    }
    checkCCPACompliance() {
        return true;
    }
    pushEvent(type, data) {
        if (!this.shouldTrackEvent(type))
            return;
        const context = this.getInteractionContext();
        let event;
        switch (type) {
            case "pageview":
                event = {
                    event_type: "pageview",
                    session_id: this.userContext.sessionId,
                    path: context.path,
                    url: context.url,
                    title: context.title,
                    viewport: context.viewport,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                    referrer: this.userContext.referrer,
                    load_time: data.load_time,
                };
                break;
            case "click":
                event = {
                    event_type: "click",
                    session_id: this.userContext.sessionId,
                    element_path: data.element,
                    element_text: data.text,
                    x_pos: data.x,
                    y_pos: data.y,
                    href: data.link?.href,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "scroll_milestone":
                event = {
                    event_type: "scroll",
                    session_id: this.userContext.sessionId,
                    depth: data.depth,
                    direction: data.direction,
                    max_depth: this.maxScrollDepth,
                    relative_depth: this.calculateScrollDepth(),
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "media_play":
                event = {
                    event_type: "media",
                    session_id: this.userContext.sessionId,
                    media_type: data.type,
                    action: data.action,
                    media_url: data.src,
                    current_time: data.currentTime,
                    duration: data.duration,
                    title: data.title,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "form_submit":
                event = {
                    event_type: "form",
                    session_id: this.userContext.sessionId,
                    form_id: data.formId,
                    action: data.action,
                    fields: data.fields,
                    success: data.success,
                    error_message: data.errorMessage,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "conversion":
                event = {
                    event_type: "conversion",
                    session_id: this.userContext.sessionId,
                    conversion_type: data.conversionType,
                    value: data.value,
                    currency: data.currency || "USD",
                    products: data.products,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "error":
                event = {
                    event_type: "error",
                    session_id: this.userContext.sessionId,
                    error_type: data.errorType,
                    message: data.message,
                    stack_trace: data.stackTrace,
                    component: data.component,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            case "performance":
                event = {
                    event_type: "performance",
                    session_id: this.userContext.sessionId,
                    metric_name: data.metricName,
                    value: data.value,
                    navigation_type: data.navigationType,
                    effective_connection_type: data.effectiveConnectionType,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                };
                break;
            default:
                // For custom events or those not requiring specific structure
                event = {
                    event_type: type,
                    session_id: this.userContext.sessionId,
                    event_id: crypto.randomUUID(),
                    timestamp: new Date(),
                    user_id: this.userContext.customerUserId,
                    client_timestamp: new Date(),
                    ...data,
                };
        }
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
    shouldTrackEvent(type) {
        return this.privacySettings.allowedDataTypes.includes(type);
    }
    getInteractionContext() {
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
    getBusinessMetrics() {
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
    calculateScrollDepth() {
        const winHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        return Math.round(((scrollTop + winHeight) / docHeight) * 100);
    }
    calculateReadingTime() {
        const content = document.querySelector("article, .content")?.textContent || "";
        const wordCount = content.trim().split(/\s+/).length;
        return Math.round(wordCount / 200); // Assuming 200 words per minute reading speed
    }
    updateActiveTime() {
        const now = Date.now();
        if (now - this.lastActiveTime < 30000) {
            // Consider user active if interaction within last 30s
            this.activeTimeTotal += 1000;
        }
    }
    initializeTracking() {
        // Track clicks with enhanced context
        document.addEventListener("click", (e) => {
            const target = e.target;
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
        document.addEventListener("play", (e) => {
            const media = e.target;
            this.mediaHistory.add(media.src);
            this.pushEvent("media_play", {
                type: media instanceof HTMLVideoElement ? "video" : "audio",
                src: media.src,
                duration: media.duration,
                title: media.title || this.getElementPath(media),
            });
        }, true);
        // Track downloads
        document.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link?.download ||
                (link?.href && /\.(pdf|doc|docx|xls|xlsx|zip|rar)$/i.test(link.href))) {
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
            const form = e.target;
            this.pushEvent("form_submit", {
                formId: form.id || this.getElementPath(form),
                action: form.action,
                fields: Array.from(form.elements).map((el) => ({
                    type: el.type,
                    name: el.name,
                    isValid: el.validity.valid,
                })),
            });
        });
        // Track content visibility
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const element = entry.target;
                if (entry.isIntersecting && element.hasAttribute("data-content-id")) {
                    this.contentHistory.add(element.getAttribute("data-content-id") || "");
                    this.pushEvent("content_view", {
                        contentId: element.getAttribute("data-content-id"),
                        contentType: element.getAttribute("data-content-type"),
                        visibleTime: entry.time,
                        viewportCoverage: entry.intersectionRatio,
                    });
                }
            });
        }, { threshold: [0, 0.5, 1] });
        document
            .querySelectorAll("[data-content-id]")
            .forEach((el) => observer.observe(el));
        // Track maximum scroll depth
        document.addEventListener("scroll", () => {
            const currentDepth = this.calculateScrollDepth();
            this.maxScrollDepth = Math.max(this.maxScrollDepth, currentDepth);
            // Calculate total scroll distance
            const currentPosition = window.scrollY;
            this.totalScrollDistance += Math.abs(currentPosition - this.lastScrollPosition);
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
                const key = `${Math.floor(e.clientX / 50)},${Math.floor(e.clientY / 50)}`;
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
    getElementPath(element) {
        const path = [];
        let current = element;
        while (current) {
            let identifier = current.tagName.toLowerCase();
            if (current.id) {
                identifier += `#${current.id}`;
            }
            else if (current.className) {
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
    async compressData(data) {
        const jsonString = JSON.stringify(data);
        const textEncoder = new TextEncoder();
        const compressed = await new Response(new Blob([textEncoder.encode(jsonString)])
            .stream()
            .pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
        return new Uint8Array(compressed);
    }
    async sendData(data) {
        const batchRequest = {
            events: this.events,
        };
        // Remove compression for now to simplify testing
        const response = await fetch(`${API_URL}/api/v1/analytics/batch`, {
            method: "POST",
            body: JSON.stringify(batchRequest),
            headers: {
                "Content-Type": "application/json",
                // Remove the Content-Encoding header since we're not compressing
                // "Content-Encoding": "gzip",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }
    async processBatch() {
        if (!this.events.length)
            return;
        const batch = this.events.splice(0, this.options.batchSize);
        let attempts = 0;
        while (attempts < this.options.retryAttempts) {
            try {
                const compressed = await this.compressData(batch);
                await this.sendData(compressed);
                break;
            }
            catch (error) {
                attempts++;
                if (attempts === this.options.retryAttempts) {
                    this.events.unshift(...batch);
                    if (this.options.debug) {
                        console.error("Failed to process batch after retries:", error);
                    }
                }
                else {
                    await new Promise((resolve) => setTimeout(resolve, this.options.retryDelay * attempts));
                }
            }
        }
    }
    async sendRealTimeEvent(event) {
        if (!this.options.enableRealTime)
            return;
        try {
            await fetch(`${API_URL}/api/v1/analytics/realtime`, {
                method: "POST",
                body: JSON.stringify(event),
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }
        catch (error) {
            console.error("Real-time analytics error:", error);
        }
    }
    // Public API methods
    identify(userId, traits) {
        this.userContext.customerUserId = userId;
        if (traits) {
            this.pushEvent("identify", { userId, traits });
        }
    }
    track(eventName, properties) {
        this.pushEvent("custom", {
            event_type: "custom",
            eventName,
            properties,
            session_id: this.userContext.sessionId,
            event_id: crypto.randomUUID(),
            timestamp: new Date(),
            user_id: this.userContext.customerUserId,
            client_timestamp: new Date(),
        });
    }
    setPrivacySettings(settings) {
        this.privacySettings = { ...this.privacySettings, ...settings };
    }
    getEngagementScore() {
        const timeOnPage = (Date.now() - this.pageLoadTime) / 1000;
        const scrollScore = this.maxScrollDepth * 0.3;
        const interactionScore = (this.interactionCount / timeOnPage) * 0.3;
        const mouseScore = (this.mouseMovements / timeOnPage) * 0.2;
        const activeTimeScore = (this.activeTimeTotal / (timeOnPage * 1000)) * 0.2;
        return Math.min(scrollScore + interactionScore + mouseScore + activeTimeScore, 1);
    }
    async sendExitData() {
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
        navigator.sendBeacon(`${API_URL}/api/v1/analytics/exit`, blob);
        if (this.options.debug) {
            console.log("Exit data:", exitData);
        }
    }
    getLastViewedSection() {
        const sections = document.querySelectorAll("section, article, [data-section]");
        let lastSection = null;
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
        const sectionAttr = lastSection.getAttribute("data-section");
        if (sectionAttr)
            return sectionAttr;
        const sectionId = lastSection.id;
        if (sectionId)
            return sectionId;
        const heading = lastSection.querySelector("h1,h2,h3");
        if (heading?.textContent)
            return heading.textContent;
        return null;
    }
    calculateElementVisibility(rect) {
        const windowHeight = window.innerHeight;
        if (rect.top > windowHeight || rect.bottom < 0)
            return 0;
        const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
        return visibleHeight / rect.height;
    }
}
Analytics.instance = null;
// Initialize analytics
const analytics = Analytics.getInstance();
// Export for use in other modules
export default analytics;
