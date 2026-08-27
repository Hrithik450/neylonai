import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const css = await readFile(new URL("./dist/widget.css", import.meta.url), "utf8");

const inlineCssPlugin = {
  name: "inline-widget-css",
  setup(buildApi) {
    buildApi.onResolve(
      { filter: /^\.\/widget-styles$/ },
      () => ({ path: "widget-styles", namespace: "neylonai" }),
    );
    buildApi.onLoad(
      { filter: /.*/, namespace: "neylonai" },
      () => ({
        contents: `export const WIDGET_STYLES = ${JSON.stringify(css)};`,
        loader: "js",
      }),
    );
  },
};

// 1. Build the advanced NPM bundle (splitting = true, format = esm)
await build({
  entryPoints: { embed: "src/embed.ts" },
  outdir: "dist",
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2017",
  minify: true,
  legalComments: "none",
  plugins: [inlineCssPlugin],
});

// 2. Build the single-file CDN widget (Option A)
await build({
  entryPoints: { "widget": "src/auto-init.ts" },
  outdir: "../../apps/web/public/v1", // Output directly to Next.js public folder
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2017",
  minify: true,
  legalComments: "none",
  plugins: [inlineCssPlugin],
});
