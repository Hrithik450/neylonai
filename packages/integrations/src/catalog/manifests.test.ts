import { describe, expect, it } from "vitest";
import { listIntegrationManifests } from "./manifests";

describe("focused integration catalog", () => {
  it("exposes only the retained customer integrations", () => {
    expect(listIntegrationManifests().map((manifest) => manifest.id)).toEqual([
      "website",
      "database",
      "web_search",
      "whatsapp",
      "calcom",
    ]);
  });
});
