import { describe, expect, test } from "bun:test";

import { createLimits } from "./limits";

describe("rates", () => {
  test("refuse a client over the rate until its window ends", async () => {
    const limits = createLimits({ requests: { max: 2, windowMs: 50 } });
    expect(limits.hit("requests", ["a"])).toEqual({ ok: true });
    expect(limits.hit("requests", ["a"])).toEqual({ ok: true });
    expect(limits.hit("requests", ["a"])).toEqual({ retryAfter: 1 });
    expect(limits.hit("requests", ["b"])).toEqual({ ok: true });
    await Bun.sleep(60);
    expect(limits.hit("requests", ["a"])).toEqual({ ok: true });
  });

  test("count nothing when one of the clients is refused", () => {
    const limits = createLimits({ games: { max: 1, windowMs: 60_000 } });
    limits.take("games", ["ip", "player"]);
    expect(() => limits.take("games", ["ip", "other player"])).toThrow("Too many requests");
    // The refused request didn't use up the other player's game.
    limits.take("games", ["elsewhere", "other player"]);
  });
});

describe("streams", () => {
  test("cap open streams per client and per instance, freeing each slot once", () => {
    const limits = createLimits({ streamsPerClient: 1, streams: 2 });
    const release = limits.openStream(["a"]);
    expect(() => limits.openStream(["a"])).toThrow("Too many open games");
    limits.openStream(["b"]);
    expect(() => limits.openStream(["c"])).toThrow("Too many open games");
    release();
    release();
    limits.openStream(["a"]);
    expect(() => limits.openStream(["c"])).toThrow("Too many open games");
  });
});
