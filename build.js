const esbuild = require("esbuild");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";
const isWatch = process.argv.includes("--watch");

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
  plugins: [
    {
      name: "rebuild-notify",
      setup(build) {
        build.onEnd((result) => {
          const date = new Date().toLocaleTimeString();
          if (result.errors.length) {
            console.error(`[${date}] 🔴 Build failed:`);
            console.error(result.errors);
          } else {
            console.log(`[${date}] 🟢 Build completed successfully`);
            if (result.warnings.length) {
              console.warn(`[${date}] ⚠️  Warnings:`);
              console.warn(result.warnings);
            }
          }
        });
      },
    },
  ],
};

if (isWatch) {
  console.log("🚀 Starting watch mode...");
  esbuild.context(baseConfig).then((context) => {
    context.watch();
    console.log("👀 Watching for changes...");
  });
} else {
  console.log("📦 Building...");
  esbuild
    .build(baseConfig)
    .then(() => console.log("✅ Build complete"))
    .catch(() => {
      console.error("❌ Build failed");
      process.exit(1);
    });
}
