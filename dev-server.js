const esbuild = require("esbuild");
const fs = require("fs/promises");
const path = require("path");

async function startDevServer() {
  await fs.mkdir("dist", { recursive: true });
  await fs.copyFile("src/static/index.html", "dist/index.html");

  // Start esbuild's built-in server
  const ctx = await esbuild.context({
    entryPoints: [
      "src/static/ts/analytics.ts",
      "src/static/ts/analytics.worker.ts",
      "src/static/ts/authWebhook.ts",
      "src/static/ts/analytics-init.ts",
      "src/static/ts/types/custom_types.ts",
      "src/static/ts/types/pydantic_types.ts",
    ],
    bundle: true,
    outdir: "src/dist",
    platform: "browser",
    target: ["chrome58", "firefox57", "safari11"],
    format: "esm",
    sourcemap: true,
    minify: false,
    loader: {
      ".ts": "ts",
    },
    define: {
      "process.env.NODE_ENV": '"development"',
    },
    alias: {
      "@src": path.resolve(__dirname, "src"),
    },
  });

  const { host, port } = await ctx.serve({
    servedir: ".",
    port: process.env.PORT || 3000,
  });

  console.log(
    `🚀 Development server running at http://localhost:${port}/index.html`
  );
  console.log("⌛ Waiting for file changes...\n");

  // Handle shutdown
  const cleanup = async () => {
    console.log("\n🛑 Shutting down...");
    await ctx.dispose();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

startDevServer().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
