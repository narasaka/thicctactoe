import { expect, test } from "bun:test";
import { replay } from "@thicctactoe/game";

import { buildReplay, formatClock } from "./replay";

const startedAt = new Date("2026-10-12T10:00:00Z");

test("buildReplay lists every position and what each move covered", () => {
  const moves = [
    { player: "X", size: "small", cell: 4, at: "2026-10-12T10:00:03Z" },
    { player: "O", size: "large", cell: 4, at: "2026-10-12T10:00:10.500Z" },
  ] as const;
  const { positions, steps } = buildReplay(moves, startedAt);

  expect(positions).toHaveLength(3);
  expect(positions[2]).toEqual(replay(moves));
  expect(steps.map((step) => step.covered)).toEqual([null, { player: "X", size: "small" }]);
  expect(steps.map((step) => step.elapsedMs)).toEqual([3000, 10_500]);
});

test("buildReplay has no times for games logged before move times were", () => {
  const { steps } = buildReplay([{ player: "X", size: "small", cell: 0 }], null);
  expect(steps[0]!.elapsedMs).toBeNull();
});

test("formatClock", () => {
  expect(formatClock(0)).toBe("0:00");
  expect(formatClock(10_500)).toBe("0:10");
  expect(formatClock(125_000)).toBe("2:05");
  expect(formatClock(3_725_000)).toBe("1:02:05");
});
