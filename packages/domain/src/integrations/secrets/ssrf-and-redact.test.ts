import { describe, expect, it } from "vitest";
import {
  assertHostnameNotBlocked,
  assertPostgresConnectionUrl,
  isBlockedIpLiteral,
} from "@neylonai/integrations/database/constants";
import {
  configHasLegacyCredentials,
  redactIntegrationConfig,
} from "@neylonai/integrations/catalog";

describe("postgres connection URL SSRF guards", () => {
  it("accepts public postgresql URLs", () => {
    expect(
      assertPostgresConnectionUrl(
        "postgresql://neylon_readonly:x@db.example.com:5432/mydb",
      ),
    ).toContain("db.example.com");
  });

  it("rejects localhost and private IPs", () => {
    expect(() =>
      assertPostgresConnectionUrl("postgresql://u:p@localhost:5432/db"),
    ).toThrow(/Local or internal/);
    expect(() =>
      assertPostgresConnectionUrl("postgresql://u:p@10.0.0.5:5432/db"),
    ).toThrow(/Private/);
    expect(() =>
      assertPostgresConnectionUrl("postgresql://u:p@169.254.169.254:5432/db"),
    ).toThrow(/Private/);
  });

  it("flags blocked IP literals", () => {
    expect(isBlockedIpLiteral("127.0.0.1")).toBe(true);
    expect(isBlockedIpLiteral("8.8.8.8")).toBe(false);
    expect(isBlockedIpLiteral("fd12::1")).toBe(true);
  });

  it("rejects .internal hosts", () => {
    expect(() => assertHostnameNotBlocked("db.corp.internal")).toThrow();
  });
});

describe("redactIntegrationConfig", () => {
  it("strips credential keys", () => {
    const redacted = redactIntegrationConfig(
      { connectionUrl: "postgresql://secret", host: "db.example.com" },
      ["connectionUrl"],
    );
    expect(redacted.connectionUrl).toBeUndefined();
    expect(redacted.host).toBe("db.example.com");
  });

  it("detects legacy credentials in config", () => {
    expect(
      configHasLegacyCredentials(
        { connectionUrl: "postgresql://x" },
        ["connectionUrl"],
      ),
    ).toBe(true);
    expect(
      configHasLegacyCredentials({ host: "db.example.com" }, ["connectionUrl"]),
    ).toBe(false);
  });
});
