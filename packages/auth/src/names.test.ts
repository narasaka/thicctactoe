import { describe, expect, test } from "bun:test";

import { DISPLAY_NAME_MAX, displayName } from "./names";

describe("displayName", () => {
  test("keeps a normal name", () => {
    expect(displayName("Chonky Capybara")).toBe("Chonky Capybara");
  });

  test("trims and collapses whitespace", () => {
    expect(displayName("  Thicc \n\t Otter ")).toBe("Thicc Otter");
  });

  test("drops invisible characters", () => {
    expect(displayName("Zesty​​Yak")).toBe("Zesty Yak");
    expect(displayName("​‮")).toBeNull();
  });

  test("rejects empty names", () => {
    expect(displayName("")).toBeNull();
    expect(displayName("   ")).toBeNull();
  });

  test("limits length by character, not code unit", () => {
    expect(displayName("a".repeat(DISPLAY_NAME_MAX))).toBe("a".repeat(DISPLAY_NAME_MAX));
    expect(displayName("a".repeat(DISPLAY_NAME_MAX + 1))).toBeNull();
    expect(displayName("🦦".repeat(DISPLAY_NAME_MAX))).toBe("🦦".repeat(DISPLAY_NAME_MAX));
  });
});
