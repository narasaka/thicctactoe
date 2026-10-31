const K = 32;

/**
 * The most rating one player can gain from the same opponent, net, over the
 * last `PAIR_RATING_WINDOW_MS`. Rivals trading wins stay well under it; one
 * player beating an evenly rated opponent over and over reaches it in about
 * 17 straight wins.
 */
export const PAIR_RATING_CAP = 150;
export const PAIR_RATING_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Elo rating change for player A after a game against B.
 * `score` is 1 for a win, 0.5 for a draw and 0 for a loss; B changes by the
 * negation.
 */
export function ratingChange(ratingA: number, ratingB: number, score: 0 | 0.5 | 1) {
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  return Math.round(K * (score - expected));
}

/**
 * The part of A's rating `change` that stays under the cap, given A has
 * already gained `gained` from B within the window (negative if B is up).
 * Only the direction over the cap is limited: whoever is down still wins
 * points back at full value.
 */
export function capPairChange(change: number, gained: number) {
  if (change > 0) return Math.max(0, Math.min(change, PAIR_RATING_CAP - gained));
  return Math.min(0, Math.max(change, -PAIR_RATING_CAP - gained));
}
