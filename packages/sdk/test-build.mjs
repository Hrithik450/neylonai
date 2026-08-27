import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("./dist/widget.css", import.meta.url), "utf8");

await build({
  entryPoints: { "widget": "src/auto-init.ts" },
  outdir: "dist/v1",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2017",
  minify: true,
  legalComments: "none",
  plugins: [
    {
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
    },
  ],
});
