// Configuration object to replace process.env values in the Chrome extension environment
const config = {
  BASE_URL: "http://localhost:3000",
  API_URL: "http://localhost:8000",
};

let tabId = null;

// Common function for authentication verification
async function isAuthenticated() {
  try {
    // Retrieve the access token from the cookie
    const cookie = await chrome.cookies.get({
      url: config.BASE_URL,
      name: "access_token",
    });

    if (!cookie || !cookie.value) {
      return false;
    }

    // Verify the token
    const response = await fetch(`${config.API_URL}/auth/verify-token`, {
      headers: {
        Authorization: `Bearer ${cookie.value}`,
      },
    });
    const data = await response.json();
    if (data.valid) {
      // Close login tab if it exists
      if (tabId) {
        chrome.tabs.remove(tabId);
        tabId = null;
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error verifying auth:", err);
    return false;
  }
}

// Redirect function to handle login redirection
function redirectToLogin() {
  chrome.tabs.create(
    {
      url: `${config.BASE_URL}/login?from=extension`,
    },
    (tab) => {
      tabId = tab.id;
    }
  );
}

// Listen for tab updates so that when the login page (opened via extension)
// finishes loading we verify authentication and close it if the user is now logged in.
chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo, tab) => {
  if (
    updatedTabId === tabId &&
    changeInfo.status === "complete" &&
    isAuthenticated()
  ) {
    chrome.tabs.remove(tabId);
    tabId = null;
  }
});

// Keep service worker alive
chrome.runtime.onConnect.addListener(function (port) {
  port.onDisconnect.addListener(function () {
    // Handle disconnect if needed
  });
});

// Optional: Log when service worker starts/stops
console.log("Service worker started");

chrome.runtime.onInstalled.addListener(async () => {
  if (!(await isAuthenticated())) {
    redirectToLogin();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  if (!(await isAuthenticated())) {
    redirectToLogin();
  }
});
