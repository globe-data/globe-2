// content.ts
const setupAnalytics = () => {
  // Create a script element for analytics.js
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("dist/analytics.js");
  script.type = "module";

  // Create a custom event that will be dispatched once analytics.js is loaded
  script.onload = () => {
    const event = new CustomEvent("ANALYTICS_LOADED", {
      detail: {
        workerUrl: chrome.runtime.getURL("dist/analytics.worker.js"),
      },
    });
    window.dispatchEvent(event);
  };

  // Add event listener script
  const listenerScript = document.createElement("script");
  listenerScript.type = "module";
  listenerScript.src = chrome.runtime.getURL("dist/analytics-init.js");

  // Append scripts in order
  document.head.appendChild(script);
  document.head.appendChild(listenerScript);
};

setupAnalytics();
