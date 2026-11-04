import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import JSONbig from "json-bigint";
import { instagram } from "../../src/lib/inbox/adapters/instagram";
import { whatsapp } from "../../src/lib/inbox/adapters/whatsapp";
import { viber } from "../../src/lib/inbox/adapters/viber";
import { outsideHours } from "../../src/lib/inbox/auto-replies";
import ig from "../fixtures/inbox/instagram.json";
import wa from "../fixtures/inbox/whatsapp.json";
const context = { accountId: "account", chatId: "user", credentials: { accessToken: "test-token" }, lastIncomingAt: new Date(), subscribed: true };
afterEach(() => vi.unstubAllGlobals());
describe("channel normalization", () => {
  it("keeps Instagram identities separate and parses its read receipt", () => {
    expect(instagram.parseIncoming(ig)).toMatchObject([{ kind: "message", channelType: "INSTAGRAM", accountId: "ig-1", chatId: "igsid-1" }, { kind: "status", status: "READ", messageIds: ["ig-reply"] }]);
  });
  it("parses WhatsApp phone identity, attachment IDs and delivery statuses", () => {
    expect(whatsapp.parseIncoming(wa)).toMatchObject([{ kind: "message", accountId: "wa-phone-1", phone: "+995555123456", name: "Nino", text: "Plan", media: [{ mediaId: "media-1" }] }, { kind: "status", status: "DELIVERED" }]);
  });
  it("preserves 64-bit Viber message tokens and verifies signatures with the bot token", () => {
    const raw = readFileSync("tests/fixtures/inbox/viber.json", "utf8");
    const signature = createHmac("sha256", "bot-secret").update(raw).digest("hex");
    expect(viber.verifyWebhook(raw, signature, "bot-secret")).toBe(true);
    expect(viber.verifyWebhook(raw, signature, "wrong")).toBe(false);
    expect(viber.parseIncoming(JSONbig({ storeAsString: true }).parse(raw), "bot-1")[0]).toMatchObject({ messageId: "5741311803571721087", accountId: "bot-1", chatId: "viber-user-1" });
  });
  it("requires templates outside WhatsApp's service window, including on retries", async () => {
    process.env.META_GRAPH_VERSION = "v24.0";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "template-1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const expired = { ...context, lastIncomingAt: new Date(Date.now() - 86400001) };
    await expect(whatsapp.sendMessage(expired, { type: "TEXT", text: "no" })).rejects.toMatchObject({ code: "SERVICE_WINDOW_CLOSED" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await whatsapp.sendMessage(expired, { type: "TEMPLATE", text: "", payload: { template: { name: "approved", language: "en_US", parameters: ["Nino"] } } })).toBe("template-1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ type: "template", template: { name: "approved", language: { code: "en_US" } } });
  });
  it("refuses Viber sends after unsubscribe and unsupported Instagram attachments", async () => {
    await expect(viber.sendMessage({ ...context, subscribed: false }, { type: "TEXT", text: "hello" })).rejects.toMatchObject({ code: "VIBER_UNSUBSCRIBED" });
    await expect(instagram.sendMessage(context, { type: "FILE", text: "file" })).rejects.toMatchObject({ code: "INSTAGRAM_TYPE_UNSUPPORTED" });
  });
  it("calculates working hours in the configured timezone including weekends", () => {
    const settings = { welcome: "Hi", away: "Away", timezone: "Asia/Tbilisi", startHour: 9, endHour: 18, workDays: [1, 2, 3, 4, 5] };
    expect(outsideHours(settings, new Date("2026-11-04T06:00:00Z"))).toBe(false);
    expect(outsideHours(settings, new Date("2026-11-04T15:00:00Z"))).toBe(true);
    expect(outsideHours(settings, new Date("2026-11-07T06:00:00Z"))).toBe(true);
  });
});
