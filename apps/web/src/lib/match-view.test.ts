import { expect, test } from "bun:test";

import { type MatchView, newer } from "./match-view";

const view = (patch: Partial<MatchView>): MatchView => ({
  id: "g",
  status: "active",
  private: false,
  rated: true,
  seat: null,
  players: { X: null, O: null },
  moves: [],
  winner: null,
  endReason: null,
  ratingDelta: null,
  ratingCapped: false,
  rematchOffer: null,
  rematchId: null,
  search: null,
  startedAt: null,
  finishedAt: null,
  ...patch,
});
const move = { player: "X", size: "small", cell: 0 } as const;

test("newer keeps the most advanced snapshot", () => {
  const oneMove = view({ moves: [move] });
  expect(newer(null, oneMove)).toBe(oneMove);
  expect(newer(oneMove, view({ moves: [] }))).toBe(oneMove);
  expect(newer(view({ status: "finished" }), view({ status: "active" })).status).toBe("finished");
});

test("newer accepts same-progress updates, e.g. presence changes", () => {
  const online = view({ moves: [move] });
  const update = view({ moves: [move], ratingDelta: null });
  expect(newer(online, update)).toBe(update);
});

test("newer switches to a different game", () => {
  const other = view({ id: "h" });
  expect(newer(view({ moves: [move] }), other)).toBe(other);
});
