// Initialize analytics
const initializeAnalytics = async () => {
  try {
    // Create script elements for analytics and its dependencies
    const analyticsScript = document.createElement("script");
    const workerUrl = chrome.runtime.getURL("dist/analytics.worker.js");

    // Set worker URL as a data attribute that analytics.js can read
    analyticsScript.dataset.workerUrl = workerUrl;

    // Load analytics script as a module
    analyticsScript.type = "module";
    analyticsScript.src = chrome.runtime.getURL("dist/analytics.js");

    // Append analytics script
    document.head.appendChild(analyticsScript);

    console.log("Analytics scripts injected successfully");
  } catch (error) {
    console.error("Failed to initialize analytics:", error);
  }
};

// Initialize after DOM content loads
document.addEventListener("DOMContentLoaded", () => {
  initializeAnalytics().then(() => {
    console.log("Analytics initialized");
  });

  const activateButton = document.getElementById("activate-button");
  const logo = document.querySelector("img");
  const mainSubheading = document.querySelector("p.subheading:not(.caption)");
  const captionSubheading = document.querySelector("p.subheading.caption");
  const container = document.querySelector(".bg-white");

  if (
    activateButton &&
    logo &&
    mainSubheading &&
    captionSubheading &&
    container
  ) {
    // Add CSS classes for transitions
    logo.classList.add("transition-transform");
    container.classList.add("transition-box-shadow");

    activateButton.addEventListener("click", () => {
      const isActive = logo.classList.toggle("active-logo");
      container.classList.toggle("active-shadow");
      activateButton.textContent = isActive ? "End Tracking" : "Activate Globe";
      mainSubheading.textContent = isActive
        ? "Globe is active"
        : "Globe is not active";
      captionSubheading.textContent = isActive
        ? "Globe is now tracking your data securely"
        : "Other actors are currently tracking your data.";
    });
  }
});
