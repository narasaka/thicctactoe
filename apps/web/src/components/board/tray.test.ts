import { describe, expect, test } from "bun:test";

import { parseSlotId, slotId, slotsInTray } from "./tray";

describe("slotsInTray", () => {
  test("all slots are present before any move", () => {
    expect(slotsInTray("small", 5, [])).toEqual([0, 1, 2, 3, 4]);
  });

  test("removes the slots the user dragged", () => {
    expect(slotsInTray("small", 3, [1, 3])).toEqual([0, 2, 4]);
  });

  test("consumes slots from the end for moves made elsewhere", () => {
    expect(slotsInTray("medium", 1, [])).toEqual([0]);
    expect(slotsInTray("small", 3, [0])).toEqual([1, 2, 3]);
  });

  test("ignores recorded drags that the game did not accept", () => {
    expect(slotsInTray("small", 4, [2, 0])).toEqual([0, 1, 3, 4]);
  });
});

test("slot ids round-trip", () => {
  const slot = { player: "O", size: "large", index: 0 } as const;
  expect(parseSlotId(slotId("mobile", slot))).toEqual(slot);
});
