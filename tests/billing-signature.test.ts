import { describe, expect, it } from "vitest";
import { signDevPayload } from "@/lib/billing/adapter";
import { createHmac } from "crypto";

describe("billing webhook signing", () => {
  it("produces stable hmac hex signatures", () => {
    const body = JSON.stringify({ id: "evt_1", type: "subscription.activated" });
    const secret = "test-secret";
    const sig = signDevPayload(body, secret);
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    expect(sig).toBe(expected);
  });
});
