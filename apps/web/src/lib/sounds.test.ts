import { expect, test } from "bun:test";
import { type Move, replay } from "@thicctactoe/game";

import type { MatchView } from "./match-view";
import { matchSound, moveSounds, resultSound } from "./sounds";

const game = (...moves: Move[]) => replay(moves);
const X = (size: Move["size"], cell: number): Move => ({ player: "X", size, cell });
const O = (size: Move["size"], cell: number): Move => ({ player: "O", size, cell });

test("a move onto an empty cell places, onto a piece gobbles", () => {
  const before = game(X("small", 0));
  expect(moveSounds(before, game(X("small", 0), O("small", 1)), ["O"])).toEqual([
    { type: "place", size: "small" },
  ]);
  expect(moveSounds(before, game(X("small", 0), O("large", 0)), ["O"])).toEqual([
    { type: "gobble", size: "large" },
  ]);
});

test("only a single new move makes a sound", () => {
  const start = game();
  const two = game(X("small", 0), O("small", 1));
  expect(moveSounds(start, two, [])).toEqual([]);
  expect(moveSounds(two, start, [])).toEqual([]);
  expect(moveSounds(two, two, [])).toEqual([]);
});

test("the winning move is followed by the result, from the viewer's side", () => {
  const moves = [X("small", 0), O("small", 3), X("small", 1), O("small", 4)];
  const before = game(...moves);
  const after = game(...moves, X("small", 2));
  const result = (seats: ("X" | "O")[]) => moveSounds(before, after, seats)[1];
  expect(result(["X"])).toEqual({ type: "win" });
  expect(result(["O"])).toEqual({ type: "lose" });
  expect(result(["X", "O"])).toEqual({ type: "win" });
  expect(result([])).toEqual({ type: "win" });
});

test("a tie sounds the same for everyone", () => {
  expect(resultSound(null, ["X"])).toEqual({ type: "draw" });
  expect(resultSound(null, [])).toEqual({ type: "draw" });
});

const view = (patch: Partial<MatchView>): MatchView => ({
  id: "g",
  status: "active",
  private: false,
  seat: "X",
  players: { X: null, O: null },
  moves: [],
  winner: null,
  endReason: null,
  ratingDelta: null,
  rematchOffer: null,
  rematchId: null,
  startedAt: null,
  finishedAt: null,
  ...patch,
});

test("an opponent arriving starts the game", () => {
  expect(matchSound(view({ status: "waiting" }), view({}))).toEqual({ type: "start" });
});

test("a resignation sounds like the result", () => {
  const resigned = (winner: "X" | "O") => view({ status: "finished", endReason: "resign", winner });
  expect(matchSound(view({}), resigned("X"))).toEqual({ type: "win" });
  expect(matchSound(view({}), resigned("O"))).toEqual({ type: "lose" });
});

test("a game ending on the board is left to the board", () => {
  const won = view({ status: "finished", endReason: "line", winner: "X" });
  expect(matchSound(view({}), won)).toBeNull();
  expect(matchSound(view({}), view({ id: "h", status: "finished" }))).toBeNull();
});
