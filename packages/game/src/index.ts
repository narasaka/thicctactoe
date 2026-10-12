import { z } from "zod";

/**
 * Rules for thicctactoe: tic-tac-toe where each player has a limited
 * inventory of small, medium and large pieces, and a bigger piece may cover
 * any smaller piece (including the opponent's).
 *
 * A game is fully determined by its move list, so the same rules run on the
 * client (local play, optimistic updates) and on the server (authoritative
 * online play).
 */

export const PLAYERS = ["X", "O"] as const;
export const SIZES = ["small", "medium", "large"] as const;
export const CELL_COUNT = 9;

export const INVENTORY = { small: 5, medium: 3, large: 1 } as const satisfies Record<Size, number>;

export const playerSchema = z.enum(PLAYERS);
export const sizeSchema = z.enum(SIZES);
export const moveSchema = z.object({
  player: playerSchema,
  size: sizeSchema,
  cell: z
    .number()
    .int()
    .min(0)
    .max(CELL_COUNT - 1),
});

export type Player = z.infer<typeof playerSchema>;
export type Size = z.infer<typeof sizeSchema>;
export type Move = z.infer<typeof moveSchema>;
export type Piece = { player: Player; size: Size };
export type Line = readonly [number, number, number];

export type Outcome =
  | { status: "playing" }
  | { status: "won"; winner: Player; line: Line }
  | { status: "draw" };

export type Game = {
  /** Top piece of each cell, indexed 0-8 left-to-right, top-to-bottom. */
  readonly board: readonly (Piece | null)[];
  readonly turn: Player;
  readonly moves: readonly Move[];
  readonly outcome: Outcome;
};

export type MoveError = "game_over" | "not_your_turn" | "no_pieces_left" | "cell_taken";

export type PlayResult = { ok: true; game: Game } | { ok: false; error: MoveError };

const LINES: readonly Line[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const RANK: Record<Size, number> = { small: 1, medium: 2, large: 3 };

export const other = (player: Player): Player => (player === "X" ? "O" : "X");

export function newGame(): Game {
  return {
    board: Array.from({ length: CELL_COUNT }, () => null),
    turn: "X",
    moves: [],
    outcome: { status: "playing" },
  };
}

export function piecesLeft(game: Game, player: Player): Record<Size, number> {
  const left: Record<Size, number> = { ...INVENTORY };
  for (const move of game.moves) {
    if (move.player === player) left[move.size] -= 1;
  }
  return left;
}

export function play(game: Game, move: Move): PlayResult {
  if (game.outcome.status !== "playing") return { ok: false, error: "game_over" };
  if (move.player !== game.turn) return { ok: false, error: "not_your_turn" };
  if (piecesLeft(game, move.player)[move.size] <= 0) {
    return { ok: false, error: "no_pieces_left" };
  }
  if (!fits(game.board[move.cell] ?? null, move.size)) return { ok: false, error: "cell_taken" };

  const board = game.board.map((piece, cell) =>
    cell === move.cell ? { player: move.player, size: move.size } : piece,
  );
  const moves = [...game.moves, move];
  const turn = other(move.player);
  const next: Game = { board, moves, turn, outcome: { status: "playing" } };

  return { ok: true, game: { ...next, outcome: judge(next) } };
}

/** Rebuilds a game from its move list. Throws if any move is illegal. */
export function replay(moves: readonly Move[]): Game {
  let game = newGame();
  for (const [index, move] of moves.entries()) {
    const result = play(game, move);
    if (!result.ok) throw new Error(`Illegal move #${index}: ${result.error}`);
    game = result.game;
  }
  return game;
}

function fits(top: Piece | null, size: Size) {
  return top === null || RANK[size] > RANK[top.size];
}

function judge(game: Game): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line.map((cell) => game.board[cell]?.player);
    if (a && a === b && a === c) return { status: "won", winner: a, line };
  }
  return hasLegalMove(game) ? { status: "playing" } : { status: "draw" };
}

function hasLegalMove(game: Game) {
  const left = piecesLeft(game, game.turn);
  const available = SIZES.filter((size) => left[size] > 0);
  return game.board.some((top) => available.some((size) => fits(top, size)));
}
