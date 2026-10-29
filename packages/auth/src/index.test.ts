import { getIP } from "@better-auth/core/utils/ip";
import type { Database } from "@thicctactoe/db";
import { describe, expect, test } from "bun:test";

import { createAuth } from "./index";

const auth = createAuth(
  {
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars",
    CORS_ORIGIN: "http://localhost:3001",
  },
  {} as Database,
  { onGuestCreated: async () => {}, onGuestSignedIn: async () => {} },
);

describe("client IP", () => {
  test("comes from the X-Real-IP that Railway's edge sets", () => {
    // Railway's edge sets both, overwriting what the client sent; its
    // X-Forwarded-For also lists an edge hop after the client.
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "203.0.113.7, 198.51.100.9",
    });
    expect(getIP(headers, auth.options)).toBe("203.0.113.7");
  });
});
