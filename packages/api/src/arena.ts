import { EventPublisher, ORPCError } from "@orpc/server";
import type { Database } from "@thicctactoe/db";
import { game as gameTable, playerStats, user } from "@thicctactoe/db/schema/index";
import { type Move, type Player, other, play, replay } from "@thicctactoe/game";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { ratingChange } from "./rating";

/**
 * Online play: matchmaking, invites, authoritative moves, ratings and live
 * updates. Every mutation is validated against the shared rules in
 * `@thicctactoe/game`, and every change is pushed to watchers of that game.
 *
 * Live updates and presence are kept in memory, so the server must run as a
 * single instance.
 */
export type Arena = ReturnType<typeof createArena>;

export type PlayerView = {
  name: string;
  image: string | null;
  anonymous: boolean;
  rating: number;
  online: boolean;
};

/** A game as one viewer sees it. Internal user ids never leave the server. */
export type MatchView = {
  /** Public id, as used in game links. */
  id: string;
  status: "waiting" | "active" | "finished" | "cancelled";
  private: boolean;
  /** The viewer's seat, or null for spectators. */
  seat: Player | null;
  players: Record<Player, PlayerView | null>;
  moves: Move[];
  winner: Player | null;
  endReason: "line" | "draw" | "resign" | null;
  ratingDelta: Record<Player, number> | null;
  /** The seat that offered a rematch, while the other has not accepted. */
  rematchOffer: Player | null;
  /** Public id of the rematch, once both players agreed to it. */
  rematchId: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  image: string | null;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
};

type GameRow = typeof gameTable.$inferSelect;
/** What is published to watchers: the shared view plus who sits where. */
type Snapshot = { view: Omit<MatchView, "seat">; seats: Record<Player, string | null> };
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type ArenaOptions = {
  db: Database;
  /** Public games older than this are not offered by matchmaking. */
  matchmakingWindowMs?: number;
  /** How long a waiting game survives after its creator disconnects. */
  abandonGraceMs?: number;
};

export function createArena({
  db,
  matchmakingWindowMs = 10 * 60_000,
  abandonGraceMs = 30_000,
}: ArenaOptions) {
  const publisher = new EventPublisher<Record<string, Snapshot>>();
  /** gameId -> userId -> open watch streams */
  const presence = new Map<string, Map<string, number>>();
  const abandonTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const isOnline = (gameId: string, userId: string | null) =>
    userId !== null && (presence.get(gameId)?.get(userId) ?? 0) > 0;

  async function snapshot(gameId: string): Promise<Snapshot> {
    const row = await db.query.game.findFirst({ where: { publicId: gameId } });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Game not found" });

    const ids = [row.playerX, row.playerO].filter((id) => id !== null);
    const players = ids.length
      ? await db
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
            anonymous: user.isAnonymous,
            rating: playerStats.rating,
          })
          .from(user)
          .leftJoin(playerStats, eq(playerStats.userId, user.id))
          .where(inArray(user.id, ids))
      : [];
    const seat = (userId: string | null): PlayerView | null => {
      const found = players.find((p) => p.id === userId);
      if (!found) return null;
      return {
        name: found.name,
        image: found.image,
        anonymous: found.anonymous ?? false,
        rating: found.rating ?? 1000,
        online: isOnline(gameId, found.id),
      };
    };

    return {
      view: {
        id: row.publicId,
        status: row.status,
        private: row.private,
        players: { X: seat(row.playerX), O: seat(row.playerO) },
        moves: row.moves,
        winner: row.winner,
        endReason: row.endReason,
        ratingDelta: row.ratingDelta,
        rematchOffer: row.rematchOffer,
        rematchId: row.rematchId,
      },
      seats: { X: row.playerX, O: row.playerO },
    };
  }

  function forViewer({ view, seats }: Snapshot, viewerId: string | null): MatchView {
    const seat =
      viewerId === null ? null : seats.X === viewerId ? "X" : seats.O === viewerId ? "O" : null;
    return { ...view, seat };
  }

  async function view(gameId: string, viewerId: string | null): Promise<MatchView> {
    return forViewer(await snapshot(gameId), viewerId);
  }

  async function broadcast(gameId: string) {
    publisher.publish(gameId, await snapshot(gameId));
  }

  async function lock(tx: Tx, gameId: string) {
    const [row] = await tx
      .select()
      .from(gameTable)
      .where(eq(gameTable.publicId, gameId))
      .for("update");
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Game not found" });
    return row;
  }

  function seatOf(row: GameRow, userId: string): Player | null {
    if (row.playerX === userId) return "X";
    if (row.playerO === userId) return "O";
    return null;
  }

  async function ensureStats(tx: Tx, userId: string) {
    await tx.insert(playerStats).values({ userId }).onConflictDoNothing();
  }

  async function create(tx: Tx, userId: string, isPrivate: boolean) {
    await ensureStats(tx, userId);
    const seat: Player = Math.random() < 0.5 ? "X" : "O";
    const [row] = await tx
      .insert(gameTable)
      .values({
        private: isPrivate,
        createdBy: userId,
        playerX: seat === "X" ? userId : null,
        playerO: seat === "O" ? userId : null,
      })
      .returning({ publicId: gameTable.publicId });
    return row!.publicId;
  }

  async function seat(tx: Tx, row: GameRow, userId: string) {
    await ensureStats(tx, userId);
    await tx
      .update(gameTable)
      .set({
        status: "active",
        playerX: row.playerX ?? userId,
        playerO: row.playerO ?? userId,
      })
      .where(eq(gameTable.id, row.id));
  }

  /** Ends the game and applies rating changes. `winner` null means a draw. */
  async function finish(
    tx: Tx,
    row: GameRow,
    winner: Player | null,
    endReason: "line" | "draw" | "resign",
    moves: Move[] = row.moves,
  ) {
    const x = row.playerX!;
    const o = row.playerO!;
    const stats = await tx
      .select()
      .from(playerStats)
      .where(inArray(playerStats.userId, [x, o]))
      .for("update");
    const ratingOf = (id: string) => stats.find((s) => s.userId === id)?.rating ?? 1000;
    const scoreX = winner === "X" ? 1 : winner === "O" ? 0 : 0.5;
    const deltaX = ratingChange(ratingOf(x), ratingOf(o), scoreX);
    const ratingDelta = { X: deltaX, O: -deltaX };

    for (const [player, id] of [
      ["X", x],
      ["O", o],
    ] as const) {
      const result = winner === null ? "draws" : winner === player ? "wins" : "losses";
      await tx
        .update(playerStats)
        .set({
          rating: sql`${playerStats.rating} + ${ratingDelta[player]}`,
          [result]: sql`${playerStats[result]} + 1`,
        })
        .where(eq(playerStats.userId, id));
    }

    await tx
      .update(gameTable)
      .set({ status: "finished", moves, winner, endReason, ratingDelta, finishedAt: new Date() })
      .where(eq(gameTable.id, row.id));
  }

  function connect(gameId: string, userId: string) {
    const users = presence.get(gameId) ?? new Map<string, number>();
    users.set(userId, (users.get(userId) ?? 0) + 1);
    presence.set(gameId, users);
    clearTimeout(abandonTimers.get(gameId));
    abandonTimers.delete(gameId);
  }

  function disconnect(gameId: string, userId: string) {
    const users = presence.get(gameId);
    if (!users) return;
    const count = (users.get(userId) ?? 1) - 1;
    if (count > 0) return void users.set(userId, count);
    users.delete(userId);
    if (users.size > 0) return;
    presence.delete(gameId);
    scheduleAbandon(gameId);
  }

  /** A waiting game nobody is watching would strand whoever joins it. */
  function scheduleAbandon(gameId: string) {
    clearTimeout(abandonTimers.get(gameId));
    abandonTimers.set(
      gameId,
      setTimeout(() => {
        abandonTimers.delete(gameId);
        void abandon(gameId).catch((error) => console.error("abandon failed", error));
      }, abandonGraceMs),
    );
  }

  async function abandon(gameId: string) {
    if (presence.has(gameId)) return;
    const [cancelled] = await db
      .update(gameTable)
      .set({ status: "cancelled" })
      .where(and(eq(gameTable.publicId, gameId), eq(gameTable.status, "waiting")))
      .returning({ id: gameTable.id });
    if (cancelled) await broadcast(gameId);
  }

  return {
    view,

    /** Joins the oldest open public game, or opens a new one. Returns its id. */
    async quickMatch(userId: string): Promise<string> {
      const { id, joined } = await db.transaction(async (tx) => {
        const [own] = await tx
          .select({ id: gameTable.publicId })
          .from(gameTable)
          .where(
            and(
              eq(gameTable.status, "waiting"),
              eq(gameTable.private, false),
              eq(gameTable.createdBy, userId),
            ),
          )
          .limit(1);
        if (own) return { id: own.id, joined: false };

        const [open] = await tx
          .select()
          .from(gameTable)
          .where(
            and(
              eq(gameTable.status, "waiting"),
              eq(gameTable.private, false),
              or(ne(gameTable.createdBy, userId), isNull(gameTable.createdBy)),
              gt(gameTable.createdAt, new Date(Date.now() - matchmakingWindowMs)),
            ),
          )
          .orderBy(asc(gameTable.createdAt))
          .limit(1)
          .for("update", { skipLocked: true });
        if (open) {
          await seat(tx, open, userId);
          return { id: open.publicId, joined: true };
        }
        return { id: await create(tx, userId, false), joined: false };
      });
      if (joined) await broadcast(id);
      else if (!presence.has(id)) scheduleAbandon(id);
      return id;
    },

    /** Opens a private game that only people with the link can join. */
    async invite(userId: string): Promise<string> {
      const id = await db.transaction((tx) => create(tx, userId, true));
      scheduleAbandon(id);
      return id;
    },

    async join(gameId: string, userId: string): Promise<MatchView> {
      const joined = await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (seatOf(row, userId)) return false;
        if (row.status !== "waiting") {
          throw new ORPCError("CONFLICT", { message: "This game already has two players" });
        }
        await seat(tx, row, userId);
        return true;
      });
      if (joined) await broadcast(gameId);
      return view(gameId, userId);
    },

    async move(gameId: string, userId: string, move: Move): Promise<MatchView> {
      await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (row.status !== "active") {
          throw new ORPCError("CONFLICT", { message: "This game is not in progress" });
        }
        if (seatOf(row, userId) !== move.player) {
          throw new ORPCError("FORBIDDEN", { message: "That is not your piece" });
        }
        const result = play(replay(row.moves), move);
        if (!result.ok) throw new ORPCError("CONFLICT", { message: result.error });

        const moves = [...result.game.moves];
        const { outcome } = result.game;
        if (outcome.status === "won") return finish(tx, row, outcome.winner, "line", moves);
        if (outcome.status === "draw") return finish(tx, row, null, "draw", moves);
        await tx.update(gameTable).set({ moves }).where(eq(gameTable.id, row.id));
      });
      await broadcast(gameId);
      return view(gameId, userId);
    },

    async resign(gameId: string, userId: string): Promise<MatchView> {
      await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        const seat = seatOf(row, userId);
        if (!seat) throw new ORPCError("FORBIDDEN", { message: "You are not playing this game" });
        if (row.status !== "active") {
          throw new ORPCError("CONFLICT", { message: "This game is not in progress" });
        }
        await finish(tx, row, other(seat), "resign");
      });
      await broadcast(gameId);
      return view(gameId, userId);
    },

    /**
     * Offers to play the same opponent again once a game is over, or accepts
     * their offer. Accepting starts the rematch with colors swapped; watchers
     * of the finished game learn its id.
     */
    async rematch(gameId: string, userId: string): Promise<MatchView> {
      await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        const seat = seatOf(row, userId);
        if (!seat) throw new ORPCError("FORBIDDEN", { message: "You are not playing this game" });
        if (row.status !== "finished") {
          throw new ORPCError("CONFLICT", { message: "This game is not over yet" });
        }
        if (row.rematchId) return;
        if (!row.playerX || !row.playerO) {
          throw new ORPCError("CONFLICT", { message: "Your opponent is no longer around" });
        }
        if (row.rematchOffer !== other(seat)) {
          await tx.update(gameTable).set({ rematchOffer: seat }).where(eq(gameTable.id, row.id));
          return;
        }
        const [next] = await tx
          .insert(gameTable)
          .values({
            status: "active",
            private: row.private,
            createdBy: userId,
            playerX: row.playerO,
            playerO: row.playerX,
          })
          .returning({ publicId: gameTable.publicId });
        await tx
          .update(gameTable)
          .set({ rematchOffer: null, rematchId: next!.publicId })
          .where(eq(gameTable.id, row.id));
      });
      await broadcast(gameId);
      return view(gameId, userId);
    },

    /** Withdraws a game that is still waiting for an opponent. */
    async cancel(gameId: string, userId: string): Promise<MatchView> {
      await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (row.createdBy !== userId) {
          throw new ORPCError("FORBIDDEN", { message: "Only the host can cancel this game" });
        }
        if (row.status !== "waiting") {
          throw new ORPCError("CONFLICT", { message: "This game has already started" });
        }
        await tx.update(gameTable).set({ status: "cancelled" }).where(eq(gameTable.id, row.id));
      });
      await broadcast(gameId);
      return view(gameId, userId);
    },

    /**
     * Streams the game: its current state first, then every change until
     * `signal` aborts. Players watching count as online.
     */
    async *watch(gameId: string, userId: string | null, signal?: AbortSignal) {
      const updates = publisher.subscribe(gameId, { signal });
      const initial = await snapshot(gameId);
      const player = userId !== null && forViewer(initial, userId).seat !== null;
      try {
        if (player) {
          // Announce the player as online; this stream receives that update too.
          connect(gameId, userId);
          await broadcast(gameId);
        } else {
          yield forViewer(initial, userId);
        }
        for await (const update of updates) yield forViewer(update, userId);
      } finally {
        if (player) {
          disconnect(gameId, userId);
          await broadcast(gameId).catch(() => {});
        }
      }
    },

    /** Signed-in (non-anonymous) players who have finished at least one game. */
    async leaderboard(limit = 50): Promise<LeaderboardEntry[]> {
      const rows = await db
        .select({
          name: user.name,
          image: user.image,
          rating: playerStats.rating,
          wins: playerStats.wins,
          losses: playerStats.losses,
          draws: playerStats.draws,
        })
        .from(playerStats)
        .innerJoin(user, eq(user.id, playerStats.userId))
        .where(
          and(
            eq(user.isAnonymous, false),
            gt(sql`${playerStats.wins} + ${playerStats.losses} + ${playerStats.draws}`, 0),
          ),
        )
        .orderBy(desc(playerStats.rating), desc(playerStats.wins), asc(user.createdAt))
        .limit(limit);
      return rows.map((row, index) => ({ rank: index + 1, ...row }));
    },

    /**
     * Moves an anonymous player's games and record onto the account they
     * signed in with, before the anonymous user is deleted.
     */
    async mergePlayers(fromId: string, toId: string) {
      if (fromId === toId) return;
      await db.transaction(async (tx) => {
        for (const column of ["playerX", "playerO", "createdBy"] as const) {
          await tx
            .update(gameTable)
            .set({ [column]: toId })
            .where(eq(gameTable[column], fromId));
        }
        const [from] = await tx
          .delete(playerStats)
          .where(eq(playerStats.userId, fromId))
          .returning();
        if (!from) return;
        await tx
          .insert(playerStats)
          .values({
            userId: toId,
            rating: from.rating,
            wins: from.wins,
            losses: from.losses,
            draws: from.draws,
          })
          .onConflictDoUpdate({
            target: playerStats.userId,
            set: {
              // Keep the account's rating and add what the guest gained or lost.
              rating: sql`${playerStats.rating} + ${from.rating - 1000}`,
              wins: sql`${playerStats.wins} + ${from.wins}`,
              losses: sql`${playerStats.losses} + ${from.losses}`,
              draws: sql`${playerStats.draws} + ${from.draws}`,
            },
          });
      });
    },
  };
}
