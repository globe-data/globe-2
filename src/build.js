const esbuild = require("esbuild");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

const buildOptions = {
  entryPoints: ["static/ts/analytics.ts"],
  bundle: true,
  sourcemap: isDev,
  minify: !isDev,
  target: ["es2018"],
  outfile: path.join(__dirname, "static", "dist", "analytics.js"),
  format: "esm",
};

if (isDev) {
  // Development with watch mode and serve
  esbuild.context(buildOptions).then((context) => {
    // Start the build
    context.watch();

    // Start the dev server
    context
      .serve({
        servedir: path.join(__dirname, "static"),
        port: 3000,
        host: "localhost",
      })
      .then((server) => {
        console.log(`Serving at http://${server.host}:${server.port}`);
      });
  });
} else {
  // Production build
  esbuild.build(buildOptions);
}
