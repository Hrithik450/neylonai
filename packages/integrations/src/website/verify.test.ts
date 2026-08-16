import { describe, expect, it } from "vitest";
import { normalizeWebsiteInputUrl, WebsiteUrlError } from "./verify";

function issueCode(raw: string): string {
  try {
    normalizeWebsiteInputUrl(raw);
    return "ok";
  } catch (error) {
    return error instanceof WebsiteUrlError ? error.code : "unknown";
  }
}

describe("normalizeWebsiteInputUrl", () => {
  it("upgrades bare hosts and http input to https", () => {
    expect(normalizeWebsiteInputUrl("acme.com").toString()).toBe(
      "https://acme.com/",
    );
    expect(normalizeWebsiteInputUrl("http://acme.com/pricing").toString()).toBe(
      "https://acme.com/pricing",
    );
  });

  it("strips credentials and fragments", () => {
    const parsed = normalizeWebsiteInputUrl("https://a:b@acme.com/docs#top");
    expect(parsed.username).toBe("");
    expect(parsed.password).toBe("");
    expect(parsed.toString()).toBe("https://acme.com/docs");
  });

  it("rejects malformed addresses", () => {
    expect(issueCode("")).toBe("invalid_url");
    expect(issueCode("not a url")).toBe("invalid_url");
    expect(issueCode("acme")).toBe("invalid_url");
    expect(issueCode("https://acme..com")).toBe("invalid_url");
    expect(issueCode("https://-acme.com")).toBe("invalid_url");
    expect(issueCode("ftp://acme.com")).toBe("invalid_url");
    expect(issueCode("javascript:alert(1)")).toBe("invalid_url");
  });

  it("rejects local and private hosts", () => {
    expect(issueCode("http://localhost:3000")).toBe("private_address");
    expect(issueCode("https://127.0.0.1")).toBe("private_address");
    expect(issueCode("https://192.168.1.10")).toBe("private_address");
    expect(issueCode("https://internal.local")).toBe("private_address");
  });

  it("accepts normal public sites", () => {
    expect(issueCode("https://acme.com")).toBe("ok");
    expect(issueCode("https://docs.acme.co.uk/guide")).toBe("ok");
  });
});
