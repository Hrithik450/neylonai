export type WidgetFontCatalogGroup = "system" | "google";

export type WidgetFontCatalogEntry = {
  id: string;
  label: string;
  group: WidgetFontCatalogGroup;
  family: string;
  cssUrl?: string;
};

export const SYSTEM_UI_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const DEFAULT_WIDGET_FONT = {
  source: "catalog" as const,
  family: '"Bricolage Grotesque", ' + SYSTEM_UI_FONT_STACK,
  catalogId: "bricolage-grotesque",
  cssUrl: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&display=swap",
};

const S = SYSTEM_UI_FONT_STACK;
const serif = 'ui-serif, Georgia, serif';
const mono = 'ui-monospace, monospace';
const g = (id: string, label: string, name: string, weights: string, base = S): WidgetFontCatalogEntry => ({
  id, label, group: "google",
  family: `"${name}", ${base}`,
  cssUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.replace(/ /g, "+"))}:wght@${weights}&display=swap`,
});

export const WIDGET_FONT_CATALOG: WidgetFontCatalogEntry[] = [
  { id: "system", label: "System default", group: "system", family: S },
  g("bricolage-grotesque", "Bricolage Grotesque", "Bricolage Grotesque", "400;500;600;700"),
  { id: "system-serif", label: "System serif", group: "system", family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { id: "system-mono", label: "System mono", group: "system", family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  g("inter", "Inter", "Inter", "400;500;600;700"),
  g("roboto", "Roboto", "Roboto", "400;500;700"),
  g("open-sans", "Open Sans", "Open Sans", "400;500;600;700"),
  g("lato", "Lato", "Lato", "400;700"),
  g("montserrat", "Montserrat", "Montserrat", "400;500;600;700"),
  g("poppins", "Poppins", "Poppins", "400;500;600;700"),
  g("nunito", "Nunito", "Nunito", "400;500;600;700"),
  g("source-sans-3", "Source Sans 3", "Source Sans 3", "400;500;600;700"),
  g("dm-sans", "DM Sans", "DM Sans", "400;500;600;700"),
  g("work-sans", "Work Sans", "Work Sans", "400;500;600;700"),
  g("nunito-sans", "Nunito Sans", "Nunito Sans", "400;500;600;700"),
  g("rubik", "Rubik", "Rubik", "400;500;600;700"),
  g("manrope", "Manrope", "Manrope", "400;500;600;700"),
  g("outfit", "Outfit", "Outfit", "400;500;600;700"),
  g("plus-jakarta-sans", "Plus Jakarta Sans", "Plus Jakarta Sans", "400;500;600;700"),
  g("figtree", "Figtree", "Figtree", "400;500;600;700"),
  g("space-grotesk", "Space Grotesk", "Space Grotesk", "400;500;600;700"),
  g("ibm-plex-sans", "IBM Plex Sans", "IBM Plex Sans", "400;500;600;700"),
  g("noto-sans", "Noto Sans", "Noto Sans", "400;500;600;700"),
  g("mulish", "Mulish", "Mulish", "400;500;600;700"),
  g("karla", "Karla", "Karla", "400;500;600;700"),
  g("cabin", "Cabin", "Cabin", "400;500;600;700"),
  g("raleway", "Raleway", "Raleway", "400;500;600;700"),
  g("ubuntu", "Ubuntu", "Ubuntu", "400;500;700"),
  g("pt-sans", "PT Sans", "PT Sans", "400;700"),
  g("libre-franklin", "Libre Franklin", "Libre Franklin", "400;500;600;700"),
  g("schibsted-grotesk", "Schibsted Grotesk", "Schibsted Grotesk", "400;500;600;700"),
  g("geist", "Geist", "Geist", "400;500;600;700"),
  g("be-vietnam-pro", "Be Vietnam Pro", "Be Vietnam Pro", "400;500;600;700"),
  g("public-sans", "Public Sans", "Public Sans", "400;500;600;700"),
  g("lexend", "Lexend", "Lexend", "400;500;600;700"),
  g("sora", "Sora", "Sora", "400;500;600;700"),
  g("archivo", "Archivo", "Archivo", "400;500;600;700"),
  g("barlow", "Barlow", "Barlow", "400;500;600;700"),
  g("fira-sans", "Fira Sans", "Fira Sans", "400;500;600;700"),
  g("crimson-pro", "Crimson Pro", "Crimson Pro", "400;500;600;700", serif),
  g("libre-baskerville", "Libre Baskerville", "Libre Baskerville", "400;700", serif),
  g("merriweather", "Merriweather", "Merriweather", "400;700", serif),
  g("playfair-display", "Playfair Display", "Playfair Display", "400;500;600;700", serif),
  g("source-serif-4", "Source Serif 4", "Source Serif 4", "400;500;600;700", serif),
  g("jetbrains-mono", "JetBrains Mono", "JetBrains Mono", "400;500;600;700", mono),
  g("space-mono", "Space Mono", "Space Mono", "400;700", mono),
];

const BY_ID = new Map(WIDGET_FONT_CATALOG.map((e) => [e.id, e]));

export const getFontCatalogEntry = (id: string | null | undefined): WidgetFontCatalogEntry | null =>
  id ? BY_ID.get(id) ?? null : null;

export const matchCatalogByFamilyName = (rawName: string): WidgetFontCatalogEntry | null => {
  const needle = rawName.replace(/['"]/g, "").trim().toLowerCase();
  if (!needle) return null;
  return WIDGET_FONT_CATALOG.find(e =>
    e.group !== "system" &&
    (e.family.split(",")[0]?.replace(/['"]/g, "").trim().toLowerCase() === needle ||
     e.label.toLowerCase() === needle)
  ) ?? null;
};
