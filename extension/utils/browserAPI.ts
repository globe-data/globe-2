declare const chrome: any;
declare const browser: any;

const browserAPI = {
  runtime: {
    getURL: (path: string): string => {
      if (typeof browser !== "undefined") {
        return browser.runtime.getURL(path);
      }
      return chrome.runtime.getURL(path);
    },

    sendMessage: async (message: any): Promise<any> => {
      if (typeof browser !== "undefined") {
        return browser.runtime.sendMessage(message);
      }
      return new Promise((resolve) =>
        chrome.runtime.sendMessage(message, resolve)
      );
    },

    onMessage: {
      addListener: (callback: (message: any, sender: any) => void) => {
        if (typeof browser !== "undefined") {
          browser.runtime.onMessage.addListener(callback);
        } else {
          chrome.runtime.onMessage.addListener(callback);
        }
      },
      removeListener: (callback: (message: any, sender: any) => void) => {
        if (typeof browser !== "undefined") {
          browser.runtime.onMessage.removeListener(callback);
        } else {
          chrome.runtime.onMessage.removeListener(callback);
        }
      },
    },
  },

  storage: {
    sync: {
      get: async (keys: string[]): Promise<any> => {
        if (typeof browser !== "undefined") {
          return browser.storage.sync.get(keys);
        }
        return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
      },

      set: async (items: object): Promise<void> => {
        if (typeof browser !== "undefined") {
          return browser.storage.sync.set(items);
        }
        return new Promise((resolve) =>
          chrome.storage.sync.set(items, resolve)
        );
      },
    },
    local: {
      get: async (keys: string[]): Promise<any> => {
        if (typeof browser !== "undefined") {
          return browser.storage.local.get(keys);
        }
        return new Promise((resolve) =>
          chrome.storage.local.get(keys, resolve)
        );
      },

      set: async (items: object): Promise<void> => {
        if (typeof browser !== "undefined") {
          return browser.storage.local.set(items);
        }
        return new Promise((resolve) =>
          chrome.storage.local.set(items, resolve)
        );
      },
    },
  },

  tabs: {
    query: async (queryInfo: object): Promise<any[]> => {
      if (typeof browser !== "undefined") {
        return browser.tabs.query(queryInfo);
      }
      return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
    },

    sendMessage: async (tabId: number, message: any): Promise<any> => {
      if (typeof browser !== "undefined") {
        return browser.tabs.sendMessage(tabId, message);
      }
      return new Promise((resolve) =>
        chrome.tabs.sendMessage(tabId, message, resolve)
      );
    },
  },
};

export default browserAPI;
