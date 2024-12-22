const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs/promises");

async function startDevServer() {
  // First, ensure dist directory exists
  await fs.mkdir("dist", { recursive: true });

  // Copy index.html to dist
  await fs.copyFile("src/static/index.html", "dist/index.html");

  const ctx = await esbuild.context({
    entryPoints: [
      "src/static/ts/analytics.ts",
      "src/static/ts/analytics.worker.ts",
      "src/static/ts/authWebhook.ts",
    ],
    bundle: true,
    outdir: "dist",
    platform: "browser",
    target: ["chrome58", "firefox57", "safari11"],
    format: "esm",
    sourcemap: true,
    loader: {
      ".ts": "ts",
    },
    define: {
      "process.env.NODE_ENV": '"development"',
    },
  });

  const { host, port } = await ctx.serve({
    servedir: ".", // Serve from root directory
    port: 3000,
    onRequest: (args) => {
      // Add required security headers for SharedArrayBuffer
      args.responseHeaders = {
        ...args.responseHeaders,
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "cross-origin",
      };
    },
  });

  console.log(
    `🌎 Development server running at http://${host}:${port}/dist/index.html`
  );
}

startDevServer().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
