export type RobotsRules = {
  sitemapUrls: string[];
  disallowPrefixes: string[];
};

/**
 * Minimal robots.txt parser: Sitemap: lines and Disallow for * / NeylonAI.
 */
export function parseRobotsTxt(text: string, baseUrl: string): RobotsRules {
  const sitemapUrls: string[] = [];
  const disallowPrefixes: string[] = [];
  let applies = false;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;

    if (key === "sitemap") {
      try {
        sitemapUrls.push(new URL(value, baseUrl).toString());
      } catch {
        // ignore
      }
      continue;
    }

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      applies = agent === "*" || agent.includes("neylon");
      continue;
    }

    if (applies && key === "disallow") {
      if (value === "/") {
        disallowPrefixes.push("/");
      } else if (value.startsWith("/")) {
        disallowPrefixes.push(value);
      }
    }
  }

  return {
    sitemapUrls: [...new Set(sitemapUrls)],
    disallowPrefixes: [...new Set(disallowPrefixes)],
  };
}

export function isDisallowedByRobots(
  pathname: string,
  disallowPrefixes: string[],
): boolean {
  if (disallowPrefixes.includes("/")) return true;
  const path = pathname || "/";
  return disallowPrefixes.some(
    (prefix) => prefix !== "/" && (path === prefix || path.startsWith(prefix)),
  );
}
