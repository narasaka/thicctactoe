import type { MatchView } from "@thicctactoe/api/arena";

export type { MatchView };

const STAGE = { waiting: 0, active: 1, finished: 2, cancelled: 2 } as const;

/**
 * Snapshots arrive from both the live stream and mutation responses, in any
 * order. Keep `next` unless it is older than what we already have.
 */
export function newer(current: MatchView | null, next: MatchView): MatchView {
  if (!current || current.id !== next.id) return next;
  if (STAGE[next.status] < STAGE[current.status]) return current;
  if (next.moves.length < current.moves.length) return current;
  return next;
}
