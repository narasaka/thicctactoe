import { describe, expect, test } from "bun:test";

import { type Game, type Move, newGame, piecesLeft, play, replay } from "./index";

const X = (size: Move["size"], cell: number): Move => ({ player: "X", size, cell });
const O = (size: Move["size"], cell: number): Move => ({ player: "O", size, cell });

function mustPlay(game: Game, move: Move) {
  const result = play(game, move);
  if (!result.ok) throw new Error(result.error);
  return result.game;
}

describe("play", () => {
  test("places a piece and passes the turn", () => {
    const game = mustPlay(newGame(), X("small", 4));
    expect(game.board[4]).toEqual({ player: "X", size: "small" });
    expect(game.turn).toBe("O");
    expect(game.outcome).toEqual({ status: "playing" });
  });

  test("rejects moves out of turn", () => {
    expect(play(newGame(), O("small", 0))).toEqual({ ok: false, error: "not_your_turn" });
  });

  test("bigger pieces cover smaller ones, including the opponent's", () => {
    const game = replay([X("small", 4), O("medium", 4)]);
    expect(game.board[4]).toEqual({ player: "O", size: "medium" });
  });

  test("equal or smaller pieces cannot cover", () => {
    const game = replay([X("medium", 4)]);
    expect(play(game, O("medium", 4))).toEqual({ ok: false, error: "cell_taken" });
    expect(play(game, O("small", 4))).toEqual({ ok: false, error: "cell_taken" });
  });

  test("players cannot exceed their inventory", () => {
    const game = replay([X("large", 0), O("small", 1)]);
    expect(play(game, X("large", 2))).toEqual({ ok: false, error: "no_pieces_left" });
    expect(piecesLeft(game, "X")).toEqual({ small: 5, medium: 3, large: 0 });
  });

  test("detects a win and its line", () => {
    const game = replay([
      X("small", 0),
      O("small", 3),
      X("small", 1),
      O("small", 4),
      X("small", 2),
    ]);
    expect(game.outcome).toEqual({ status: "won", winner: "X", line: [0, 1, 2] });
    expect(play(game, O("small", 5))).toEqual({ ok: false, error: "game_over" });
  });

  test("covering can steal a line", () => {
    const game = replay([
      X("small", 0),
      O("small", 3),
      X("small", 1),
      O("medium", 2),
      X("small", 6),
      O("medium", 0),
      X("small", 7),
      O("large", 1),
    ]);
    expect(game.outcome).toEqual({ status: "won", winner: "O", line: [0, 1, 2] });
  });

  test("is a draw when the player to move has no legal move", () => {
    const game = replay([
      X("small", 4),
      O("small", 5),
      X("medium", 8),
      O("small", 6),
      X("medium", 1),
      O("medium", 4),
      X("medium", 2),
      O("large", 1),
      X("large", 3),
      O("small", 0),
      X("small", 7),
      O("medium", 5),
    ]);
    // Every cell is occupied and X only has small pieces left.
    expect(piecesLeft(game, "X")).toEqual({ small: 3, medium: 0, large: 0 });
    expect(game.outcome).toEqual({ status: "draw" });
  });
});

describe("replay", () => {
  test("throws on an illegal move", () => {
    expect(() => replay([X("small", 0), X("small", 1)])).toThrow("Illegal move #1: not_your_turn");
  });
});
