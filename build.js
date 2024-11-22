const esbuild = require("esbuild");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

const buildOptions = {
  entryPoints: ["static/ts/analytics.ts"],
  bundle: true,
  sourcemap: isDev,
  minify: !isDev,
  target: ["es2018"],
  outfile: path.join(__dirname, "dist", "analytics.js"),
  format: "esm",
  define: {
    SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL),
    SUPABASE_KEY: JSON.stringify(process.env.SUPABASE_KEY),
  },
};

if (isDev) {
  // Development with watch mode
  esbuild.context(buildOptions).then((context) => {
    context.watch();
    console.log("Watching for changes...");
  });
} else {
  // Production build
  esbuild.build(buildOptions);
}
