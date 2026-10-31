import { ORPCError } from "@orpc/server";

/**
 * Request rates and open live streams, counted per client IP and per player.
 *
 * The counts live in this server instance: they guard its own memory,
 * connections and database pool, which a flood would exhaust. While
 * instances overlap a client can reach each of them, so the effective limit
 * is the limit times the number of instances. What has to hold everywhere,
 * like how many games a player keeps waiting, is enforced in the database.
 */
export type Limits = ReturnType<typeof createLimits>;

export type Rate = { max: number; windowMs: number };

export type LimitOptions = {
  /** Any API request, per IP. Checked before the session is looked up. */
  requests?: Rate;
  /** Opening a game: quick match, invite or rematch. */
  games?: Rate;
  /** Opening a live stream of a game. */
  watches?: Rate;
  /** Live streams open at once, per IP or player. */
  streamsPerClient?: number;
  /** Live streams open at once on this instance. */
  streams?: number;
};

export function createLimits({
  requests = { max: 600, windowMs: 60_000 },
  games = { max: 10, windowMs: 60_000 },
  watches = { max: 120, windowMs: 60_000 },
  streamsPerClient = 20,
  streams = 10_000,
}: LimitOptions = {}) {
  const rates = { requests, games, watches };
  /** `rate:client` -> hits in the current window */
  const windows = new Map<string, { hits: number; endsAt: number }>();
  let pruneAt = 0;
  /** client -> open streams */
  const open = new Map<string, number>();
  let total = 0;

  function prune(now: number) {
    if (now < pruneAt) return;
    for (const [key, window] of windows) if (window.endsAt <= now) windows.delete(key);
    pruneAt = now + Math.max(...Object.values(rates).map((rate) => rate.windowMs));
  }

  /**
   * Counts a hit for every client, unless one of them is over the rate: then
   * nothing is counted, and the result says how many seconds to wait.
   */
  function hit(name: keyof typeof rates, clients: string[]): { ok: true } | { retryAfter: number } {
    const now = Date.now();
    prune(now);
    const rate = rates[name];
    const current = clients.map((client) => {
      const key = `${name}:${client}`;
      const window = windows.get(key);
      return window && window.endsAt > now ? { key, window } : { key, window: undefined };
    });
    const full = current.find(({ window }) => window && window.hits >= rate.max);
    if (full) return { retryAfter: Math.ceil((full.window!.endsAt - now) / 1000) };
    for (const { key, window } of current) {
      if (window) window.hits++;
      else windows.set(key, { hits: 1, endsAt: now + rate.windowMs });
    }
    return { ok: true };
  }

  return {
    hit,

    /** Like `hit`, throwing TOO_MANY_REQUESTS when refused. */
    take(name: keyof typeof rates, clients: string[]) {
      const result = hit(name, clients);
      if ("retryAfter" in result) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many requests, try again in a moment",
          data: { retryAfter: result.retryAfter },
        });
      }
    },

    /**
     * Holds a stream slot for each client until the returned function is
     * called; throws TOO_MANY_REQUESTS if a client or this instance is full.
     */
    openStream(clients: string[]): () => void {
      if (
        total >= streams ||
        clients.some((client) => (open.get(client) ?? 0) >= streamsPerClient)
      ) {
        throw new ORPCError("TOO_MANY_REQUESTS", { message: "Too many open games" });
      }
      total++;
      for (const client of clients) open.set(client, (open.get(client) ?? 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        total--;
        for (const client of clients) {
          const count = open.get(client)! - 1;
          if (count > 0) open.set(client, count);
          else open.delete(client);
        }
      };
    },
  };
}

/** The keys a request is counted under: its IP, and its player if signed in. */
export function clientsOf(context: { ip: string; session: { user: { id: string } } | null }) {
  return [`ip:${context.ip}`, ...(context.session ? [`user:${context.session.user.id}`] : [])];
}
