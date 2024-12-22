const esbuild = require("esbuild");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
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
  sourcemap: isDev,
  minify: !isDev,
  loader: {
    ".ts": "ts",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
  },
  alias: {
    "@src": path.resolve(__dirname, "src"),
  },
};

async function build() {
  try {
    if (isDev) {
      // Development: watch mode
      const context = await esbuild.context(baseConfig);
      await context.watch();
      console.log("👀 Watching for changes...");
    } else {
      // Production: single build
      await esbuild.build(baseConfig);
      console.log("✅ Build complete");
    }
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

build();
