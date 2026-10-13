import type { Game, Player, Size } from "@thicctactoe/game";

import type { MatchView } from "./match-view";

export type Sound =
  | { type: "pickup" | "place" | "gobble"; size: Size }
  | { type: "nope" | "start" | "win" | "lose" | "draw" };

/** The sound of a game ending, from the side of whoever holds `seats`. */
export function resultSound(winner: Player | null, seats: readonly Player[]): Sound {
  if (winner === null) return { type: "draw" };
  // Local games and spectators cheer for whoever won.
  return { type: seats.length === 1 && !seats.includes(winner) ? "lose" : "win" };
}

/**
 * What to play when the board goes from `before` to `after`. Only a single
 * new move makes a sound, so jumping around a replay or catching up after a
 * reconnect stays quiet.
 */
export function moveSounds(before: Game, after: Game, seats: readonly Player[]): Sound[] {
  if (after.moves.length !== before.moves.length + 1) return [];
  const move = after.moves.at(-1)!;
  const covered = before.board[move.cell] !== null;
  const sounds: Sound[] = [{ type: covered ? "gobble" : "place", size: move.size }];
  const { outcome } = after;
  if (outcome.status !== "playing") {
    sounds.push(resultSound(outcome.status === "won" ? outcome.winner : null, seats));
  }
  return sounds;
}

/**
 * What to play for a change to an online game that does not show on the
 * board: an opponent arriving, or someone resigning.
 */
export function matchSound(before: MatchView, after: MatchView): Sound | null {
  if (before.id !== after.id) return null;
  if (before.status === "waiting" && after.status === "active") return { type: "start" };
  if (before.status === "active" && after.status === "finished" && after.endReason === "resign") {
    return resultSound(after.winner, after.seat ? [after.seat] : []);
  }
  return null;
}
