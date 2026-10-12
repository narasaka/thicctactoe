import type { LoggedMove } from "@thicctactoe/api/arena";
import { type Game, type Piece, positions } from "@thicctactoe/game";

export const CELL_NAMES = [
  "top left",
  "top",
  "top right",
  "left",
  "center",
  "right",
  "bottom left",
  "bottom",
  "bottom right",
] as const;

export type ReplayStep = {
  move: LoggedMove;
  /** The piece this move covered, if any. */
  covered: Piece | null;
  /** Time since the game started, if both times were logged. */
  elapsedMs: number | null;
};

export type Replay = {
  /** Every position, from the empty board (0) to after the last move. */
  positions: Game[];
  /** What each move did; `steps[i]` leads from `positions[i]` to `positions[i + 1]`. */
  steps: ReplayStep[];
};

export function buildReplay(moves: readonly LoggedMove[], startedAt: Date | null): Replay {
  const all = positions(moves);
  const steps = moves.map((move, index) => ({
    move,
    covered: all[index]!.board[move.cell] ?? null,
    elapsedMs: move.at && startedAt ? Date.parse(move.at) - startedAt.getTime() : null,
  }));
  return { positions: all, steps };
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const [h, m, s] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
