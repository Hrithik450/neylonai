/**
 * Curated widget font catalog — system stacks + Google Fonts CSS URLs.
 * Intentionally excludes Neylon marketing fonts (Guminert, SF Pro, Banda Nova).
 */

export type WidgetFontCatalogGroup = "system" | "google";

export type WidgetFontCatalogEntry = {
  id: string;
  label: string;
  group: WidgetFontCatalogGroup;
  /** CSS font-family value applied to the widget shell. */
  family: string;
  /** Google Fonts stylesheet URL when group=google. */
  cssUrl?: string;
};

export const SYSTEM_UI_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_WIDGET_FONT = {
  source: "system" as const,
  family: SYSTEM_UI_FONT_STACK,
  catalogId: "system",
};

function googleCss(families: string): string {
  const q = encodeURIComponent(families);
  return `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
}

/** All selectable platform fonts for the dashboard dropdown. */
export const WIDGET_FONT_CATALOG: WidgetFontCatalogEntry[] = [
  {
    id: "system",
    label: "System default",
    group: "system",
    family: SYSTEM_UI_FONT_STACK,
  },
  {
    id: "system-serif",
    label: "System serif",
    group: "system",
    family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    id: "system-mono",
    label: "System mono",
    group: "system",
    family:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  {
    id: "inter",
    label: "Inter",
    group: "google",
    family: '"Inter", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Inter:wght@400;500;600;700"),
  },
  {
    id: "roboto",
    label: "Roboto",
    group: "google",
    family: '"Roboto", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Roboto:wght@400;500;700"),
  },
  {
    id: "open-sans",
    label: "Open Sans",
    group: "google",
    family: '"Open Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Open+Sans:wght@400;500;600;700"),
  },
  {
    id: "lato",
    label: "Lato",
    group: "google",
    family: '"Lato", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Lato:wght@400;700"),
  },
  {
    id: "montserrat",
    label: "Montserrat",
    group: "google",
    family: '"Montserrat", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Montserrat:wght@400;500;600;700"),
  },
  {
    id: "poppins",
    label: "Poppins",
    group: "google",
    family: '"Poppins", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Poppins:wght@400;500;600;700"),
  },
  {
    id: "nunito",
    label: "Nunito",
    group: "google",
    family: '"Nunito", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Nunito:wght@400;500;600;700"),
  },
  {
    id: "source-sans-3",
    label: "Source Sans 3",
    group: "google",
    family: '"Source Sans 3", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Source+Sans+3:wght@400;500;600;700"),
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    group: "google",
    family: '"DM Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("DM+Sans:wght@400;500;600;700"),
  },
  {
    id: "work-sans",
    label: "Work Sans",
    group: "google",
    family: '"Work Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Work+Sans:wght@400;500;600;700"),
  },
  {
    id: "nunito-sans",
    label: "Nunito Sans",
    group: "google",
    family: '"Nunito Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Nunito+Sans:wght@400;500;600;700"),
  },
  {
    id: "rubik",
    label: "Rubik",
    group: "google",
    family: '"Rubik", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Rubik:wght@400;500;600;700"),
  },
  {
    id: "manrope",
    label: "Manrope",
    group: "google",
    family: '"Manrope", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Manrope:wght@400;500;600;700"),
  },
  {
    id: "outfit",
    label: "Outfit",
    group: "google",
    family: '"Outfit", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Outfit:wght@400;500;600;700"),
  },
  {
    id: "plus-jakarta-sans",
    label: "Plus Jakarta Sans",
    group: "google",
    family: '"Plus Jakarta Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Plus+Jakarta+Sans:wght@400;500;600;700"),
  },
  {
    id: "figtree",
    label: "Figtree",
    group: "google",
    family: '"Figtree", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Figtree:wght@400;500;600;700"),
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    group: "google",
    family: '"Space Grotesk", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Space+Grotesk:wght@400;500;600;700"),
  },
  {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    group: "google",
    family: '"IBM Plex Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("IBM+Plex+Sans:wght@400;500;600;700"),
  },
  {
    id: "noto-sans",
    label: "Noto Sans",
    group: "google",
    family: '"Noto Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Noto+Sans:wght@400;500;600;700"),
  },
  {
    id: "mulish",
    label: "Mulish",
    group: "google",
    family: '"Mulish", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Mulish:wght@400;500;600;700"),
  },
  {
    id: "karla",
    label: "Karla",
    group: "google",
    family: '"Karla", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Karla:wght@400;500;600;700"),
  },
  {
    id: "cabin",
    label: "Cabin",
    group: "google",
    family: '"Cabin", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Cabin:wght@400;500;600;700"),
  },
  {
    id: "raleway",
    label: "Raleway",
    group: "google",
    family: '"Raleway", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Raleway:wght@400;500;600;700"),
  },
  {
    id: "ubuntu",
    label: "Ubuntu",
    group: "google",
    family: '"Ubuntu", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Ubuntu:wght@400;500;700"),
  },
  {
    id: "pt-sans",
    label: "PT Sans",
    group: "google",
    family: '"PT Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("PT+Sans:wght@400;700"),
  },
  {
    id: "libre-franklin",
    label: "Libre Franklin",
    group: "google",
    family: '"Libre Franklin", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Libre+Franklin:wght@400;500;600;700"),
  },
  {
    id: "schibsted-grotesk",
    label: "Schibsted Grotesk",
    group: "google",
    family: '"Schibsted Grotesk", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Schibsted+Grotesk:wght@400;500;600;700"),
  },
  {
    id: "geist",
    label: "Geist",
    group: "google",
    family: '"Geist", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Geist:wght@400;500;600;700"),
  },
  {
    id: "be-vietnam-pro",
    label: "Be Vietnam Pro",
    group: "google",
    family: '"Be Vietnam Pro", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Be+Vietnam+Pro:wght@400;500;600;700"),
  },
  {
    id: "public-sans",
    label: "Public Sans",
    group: "google",
    family: '"Public Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Public+Sans:wght@400;500;600;700"),
  },
  {
    id: "lexend",
    label: "Lexend",
    group: "google",
    family: '"Lexend", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Lexend:wght@400;500;600;700"),
  },
  {
    id: "sora",
    label: "Sora",
    group: "google",
    family: '"Sora", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Sora:wght@400;500;600;700"),
  },
  {
    id: "archivo",
    label: "Archivo",
    group: "google",
    family: '"Archivo", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Archivo:wght@400;500;600;700"),
  },
  {
    id: "barlow",
    label: "Barlow",
    group: "google",
    family: '"Barlow", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Barlow:wght@400;500;600;700"),
  },
  {
    id: "fira-sans",
    label: "Fira Sans",
    group: "google",
    family: '"Fira Sans", ' + SYSTEM_UI_FONT_STACK,
    cssUrl: googleCss("Fira+Sans:wght@400;500;600;700"),
  },
  {
    id: "crimson-pro",
    label: "Crimson Pro",
    group: "google",
    family: '"Crimson Pro", ui-serif, Georgia, serif',
    cssUrl: googleCss("Crimson+Pro:wght@400;500;600;700"),
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    group: "google",
    family: '"Libre Baskerville", ui-serif, Georgia, serif',
    cssUrl: googleCss("Libre+Baskerville:wght@400;700"),
  },
  {
    id: "merriweather",
    label: "Merriweather",
    group: "google",
    family: '"Merriweather", ui-serif, Georgia, serif',
    cssUrl: googleCss("Merriweather:wght@400;700"),
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    group: "google",
    family: '"Playfair Display", ui-serif, Georgia, serif',
    cssUrl: googleCss("Playfair+Display:wght@400;500;600;700"),
  },
  {
    id: "source-serif-4",
    label: "Source Serif 4",
    group: "google",
    family: '"Source Serif 4", ui-serif, Georgia, serif',
    cssUrl: googleCss("Source+Serif+4:wght@400;500;600;700"),
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    group: "google",
    family: '"JetBrains Mono", ui-monospace, monospace',
    cssUrl: googleCss("JetBrains+Mono:wght@400;500;600;700"),
  },
  {
    id: "space-mono",
    label: "Space Mono",
    group: "google",
    family: '"Space Mono", ui-monospace, monospace',
    cssUrl: googleCss("Space+Mono:wght@400;700"),
  },
];

const BY_ID = new Map(WIDGET_FONT_CATALOG.map((e) => [e.id, e]));

export function getFontCatalogEntry(
  id: string | null | undefined,
): WidgetFontCatalogEntry | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/** Match a detected CSS family name to a catalog entry (case-insensitive). */
export function matchCatalogByFamilyName(
  rawName: string,
): WidgetFontCatalogEntry | null {
  const needle = rawName.replace(/['"]/g, "").trim().toLowerCase();
  if (!needle) return null;
  for (const entry of WIDGET_FONT_CATALOG) {
    if (entry.group === "system") continue;
    const primary = entry.family
      .split(",")[0]
      ?.replace(/['"]/g, "")
      .trim()
      .toLowerCase();
    if (primary === needle) return entry;
    if (entry.label.toLowerCase() === needle) return entry;
  }
  return null;
}
