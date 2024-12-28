const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs/promises");
const https = require("https");
const http = require("http");

async function startDevServer() {
  await fs.mkdir("dist", { recursive: true });
  await fs.copyFile("src/static/index.html", "dist/index.html");

  // Start esbuild's built-in server
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

  // Start esbuild's dev server on a regular HTTP port
  const { host, port } = await ctx.serve({
    servedir: ".",
    port: 3001, // Internal port for esbuild
  });

  // Create HTTPS proxy
  const certDir = "certs";
  const keyPath = path.join(certDir, "key.pem");
  const certPath = path.join(certDir, "cert.pem");

  const httpsServer = https.createServer(
    {
      key: await fs.readFile(keyPath),
      cert: await fs.readFile(certPath),
    },
    (req, res) => {
      // Update CORS headers to be more permissive in development
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");

      // Forward to esbuild server
      const proxyReq = http.request(
        {
          hostname: host,
          port: port,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          // Copy original headers
          const headers = { ...proxyRes.headers };

          // Add CORS headers to responses
          headers["Cross-Origin-Opener-Policy"] = "same-origin";
          headers["Cross-Origin-Embedder-Policy"] = "credentialless";
          headers["Cross-Origin-Resource-Policy"] = "cross-origin";

          res.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(res, { end: true });
        }
      );

      req.pipe(proxyReq, { end: true });
    }
  );

  const httpsPort = process.env.PORT || 3000;
  httpsServer.listen(httpsPort, () => {
    console.log(
      `🔒 Development server running at https://localhost:${httpsPort}/dist/index.html`
    );
    console.log("⌛ Waiting for file changes...\n");
  });

  // Handle shutdown
  const cleanup = async () => {
    console.log("\n🛑 Shutting down...");
    await ctx.dispose();
    httpsServer.close();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

startDevServer().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
