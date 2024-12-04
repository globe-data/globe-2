// Inject analytics.js into the webpage
(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("analytics.js");
  script.type = "module";
  document.documentElement.appendChild(script);
  script.onload = function () {
    script.remove();
  };
})();
