import { describe, expect, it, vi } from "vitest";
import { createRefreshGate } from "../../src/components/inbox/refresh";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe("inbox refresh scheduling", () => {
  it("serializes a burst of invalidations and catches updates received during a refresh", async () => {
    const first = deferred(); const second = deferred();
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const gate = createRefreshGate(refresh);
    const running = gate.request();
    const duplicate = gate.request();
    gate.request(); gate.request();
    expect(duplicate).toBe(running);
    expect(refresh).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);
    second.resolve();
    await running;
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("drops queued refreshes after the view is disposed", async () => {
    const first = deferred(); const refresh = vi.fn().mockReturnValue(first.promise);
    const gate = createRefreshGate(refresh);
    const running = gate.request(); gate.request(); gate.dispose(); first.resolve();
    await running; await gate.request();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("allows a later invalidation to retry after a failed refresh", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const gate = createRefreshGate(refresh);
    await expect(gate.request()).rejects.toThrow("offline");
    await gate.request();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
