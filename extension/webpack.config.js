const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env) => {
  const browser = env.browser || "chrome";

  return {
    entry: {
      analytics: "./analytics.ts",
      contentScript: "./contentScript.ts",
      background: "./background.ts",
    },
    output: {
      path: path.resolve(__dirname, `dist/${browser}`),
      filename: "[name].js",
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "node_modules/webextension-polyfill/dist/browser-polyfill.min.js",
            to: "browser-polyfill.js",
          },
          {
            from: `manifests/${browser}.json`,
            to: "manifest.json",
          },
        ],
      }),
    ],
    // ... rest of your webpack config
  };
};
