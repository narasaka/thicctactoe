const K = 32;

/**
 * Elo rating change for player A after a game against B.
 * `score` is 1 for a win, 0.5 for a draw and 0 for a loss; B changes by the
 * negation.
 */
export function ratingChange(ratingA: number, ratingB: number, score: 0 | 0.5 | 1) {
  const expected = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  return Math.round(K * (score - expected));
}
