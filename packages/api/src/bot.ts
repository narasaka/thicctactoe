import {
  CELL_COUNT,
  type Game,
  type Move,
  SIZES,
  moveSchema,
  play,
  replay,
} from "@thicctactoe/game";
import { z } from "zod";

/** Picks the next move for whichever player is to move. */
export type Bot = { chooseMove(moves: readonly Move[]): Promise<Move> };

/** How long the bot service gets to answer before the fallback plays instead. */
const SERVICE_TIMEOUT_MS = 5_000;

const reply = z.object({ move: moveSchema });

function legalMoves(game: Game): Move[] {
  return SIZES.flatMap((size) =>
    Array.from({ length: CELL_COUNT }, (_, cell) => ({ player: game.turn, size, cell })),
  ).filter((move) => play(game, move).ok);
}

const wins = (game: Game, move: Move) => {
  const result = play(game, move);
  return result.ok && result.game.outcome.status === "won";
};

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;

/**
 * A simple bot that needs nothing but the rules: it takes a winning move,
 * else blocks the opponent's immediate win, else plays at random.
 */
export const fallbackBot: Bot = {
  async chooseMove(moves) {
    const game = replay(moves);
    const legal = legalMoves(game);
    const winning = legal.find((move) => wins(game, move));
    if (winning) return winning;
    const safe = legal.filter((move) => {
      const next = play(game, move);
      return next.ok && !legalMoves(next.game).some((reply) => wins(next.game, reply));
    });
    return pick(safe.length ? safe : legal);
  },
};

/**
 * The bot service, when it is configured. Whenever it is not, fails, is slow
 * or answers with an illegal move, `fallback` plays instead.
 */
export function createBot({
  url,
  token,
  fallback = fallbackBot,
  timeoutMs = SERVICE_TIMEOUT_MS,
}: {
  url?: string;
  token?: string;
  fallback?: Bot;
  timeoutMs?: number;
}): Bot {
  if (!url || !token) return fallback;
  const endpoint = `${url.replace(/\/$/, "")}/move`;

  return {
    async chooseMove(moves) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ moves }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`bot service answered ${response.status}`);
        const { move } = reply.parse(await response.json());
        const result = play(replay(moves), move);
        if (!result.ok) throw new Error(`bot service played an illegal move: ${result.error}`);
        return move;
      } catch (error) {
        console.error("bot service failed, using the fallback", error);
        return fallback.chooseMove(moves);
      }
    },
  };
}
