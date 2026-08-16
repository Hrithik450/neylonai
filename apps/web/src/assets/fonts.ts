import localFont from "next/font/local";

/**
 * App fonts live only under `src/assets/fonts/`.
 * Swap a face by changing the `src` paths here — layouts and CSS classes stay put.
 */

/** Dashboard + admin (Banda Nova Book). */
const bandaNova = localFont({
  src: "./fonts/BandaNova-Book.woff2",
  weight: "400 500",
  variable: "--font-banda",
  display: "swap",
});

/** Landing (Bricolage Grotesque) — one variable face covering 200–800. */
const landing = localFont({
  src: "./fonts/bricolage-grotesque-variable.woff2",
  weight: "200 800",
  variable: "--font-landing",
  display: "swap",
});

/** Root body — exposes `--font-banda` for `.paper`, `.admin-shell`, dialogs. */
export const appFontClassName = bandaNova.variable;

/** Landing shell — Bricolage Grotesque via `.landing` / `.landing-strong`. */
export const landingFontClassName = [landing.variable, "landing"].join(" ");
