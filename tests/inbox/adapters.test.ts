import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { facebook } from "../../src/lib/inbox/adapters/facebook";
import { encrypt, decrypt } from "../../src/lib/inbox/credentials";
import { safeMediaUrl, verifyShare, shareToken } from "../../src/lib/inbox/media";
import { phoneOrNull } from "../../src/lib/inbox/matching";
import payload from "../fixtures/inbox/facebook.json";

describe("Facebook webhook contract", () => {
  it("verifies raw bytes and rejects altered bodies or missing signatures", () => {
    const raw = JSON.stringify(payload); const secret = "app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    expect(facebook.verifyWebhook(raw, signature, secret)).toBe(true);
    expect(facebook.verifyWebhook(`${raw} `, signature, secret)).toBe(false);
    expect(facebook.verifyWebhook(raw, null, secret)).toBe(false);
    expect(facebook.verifyWebhook(raw, "sha256=wrong", secret)).toBe(false);
  });
  it("parses messages, attachment sources, deliveries and read watermarks", () => {
    const rows = facebook.parseIncoming(payload);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: "message", chatId: "psid-1", accountId: "page-1", messageId: "mid-1", text: "Hello", type: "IMAGE", media: [{ url: "https://scontent.fbcdn.net/image.jpg" }] });
    expect(rows[1]).toMatchObject({ kind: "status", status: "DELIVERED", messageIds: ["out-1"] });
    expect(rows[2]).toMatchObject({ kind: "status", status: "READ" });
    expect(facebook.parseIncoming({ object: "unknown" })).toEqual([]);
  });
});
describe("inbox boundaries", () => {
  it("encrypts secrets with tenant-bound authenticated encryption", () => {
    process.env.INBOX_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const sealed = encrypt({ accessToken: "never-plaintext" }, "tenant-a");
    expect(sealed).not.toContain("never-plaintext");
    expect(decrypt(sealed, "tenant-a")).toEqual({ accessToken: "never-plaintext" });
    expect(() => decrypt(sealed, "tenant-b")).toThrow();
    expect(() => decrypt(sealed.slice(0, -4) + "AAAA", "tenant-a")).toThrow();
  });
  it("rejects private/arbitrary URLs, credentials, insecure URLs and lookalike hosts", () => {
    for (const url of ["http://localhost/x", "https://127.0.0.1/x", "https://fbcdn.net.evil.test/x", "https://user:secret@fbcdn.net/x", "https://fbcdn.net:8443/x"]) expect(() => safeMediaUrl(url)).toThrow();
    expect(safeMediaUrl("https://scontent.fbcdn.net/image").hostname).toBe("scontent.fbcdn.net");
  });
  it("signs short-lived media links and normalizes Georgian and international phones", () => {
    process.env.INBOX_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const expires = Date.now() + 60000;
    expect(verifyShare("a", expires, shareToken("a", expires))).toBe(true);
    expect(verifyShare("b", expires, shareToken("a", expires))).toBe(false);
    expect(verifyShare("a", Date.now() - 1, "bad")).toBe(false);
    expect(phoneOrNull("555 12 34 56")).toBe("+995555123456");
    expect(phoneOrNull("+1 (202) 555-0123")).toBe("+12025550123");
    expect(phoneOrNull("not a phone")).toBeNull();
  });
});
