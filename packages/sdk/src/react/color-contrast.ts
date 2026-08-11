/**
 * Pick black or white foreground for readable text on a CSS color background.
 * Supports #rgb, #rrggbb, and rgb()/rgba(). Falls back to black if unparsable.
 */
export function contrastForeground(background: string): "#000000" | "#ffffff" {
  const rgb = parseCssColor(background);
  if (!rgb) return "#000000";
  // Relative luminance (sRGB), WCAG-ish threshold.
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#000000" : "#ffffff";
}

function parseCssColor(
  raw: string,
): [number, number, number] | null {
  const v = raw.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) {
      return [
        parseInt(h[0]! + h[0]!, 16),
        parseInt(h[1]! + h[1]!, 16),
        parseInt(h[2]! + h[2]!, 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = v.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}
