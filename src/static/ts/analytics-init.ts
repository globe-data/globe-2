window.addEventListener("ANALYTICS_LOADED", ((event: Event) => {
  const customEvent = event as CustomEvent<{ workerUrl: string }>;
  const { workerUrl } = customEvent.detail;
  const script = document.querySelector(
    'script[src*="analytics.js"]'
  ) as HTMLScriptElement;
  if (script) {
    script.dataset.workerUrl = workerUrl;
  }
}) as EventListener);
