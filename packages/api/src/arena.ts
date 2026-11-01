import { EventPublisher, ORPCError } from "@orpc/server";
import type { Database } from "@thicctactoe/db";
import {
  type LoggedMove,
  game as gameTable,
  playerStats,
  presence,
  user,
} from "@thicctactoe/db/schema/index";
import { type Move, type Player, other, play, replay } from "@thicctactoe/game";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { setTimeout as sleep } from "node:timers/promises";
import type { PoolClient } from "pg";

import { type Bot, fallbackBot } from "./bot";
import { PAIR_RATING_WINDOW_MS, capPairChange, ratingChange } from "./rating";

export type { LoggedMove };

/**
 * Online play: matchmaking, invites, authoritative moves, ratings and live
 * updates. Every mutation is validated against the shared rules in
 * `@thicctactoe/game`, and every change is pushed to watchers of that game.
 *
 * Changes are announced over Postgres NOTIFY and presence lives in the
 * database, so any number of server instances can run side by side, which is
 * what a zero-downtime deploy does for a moment.
 */
export type Arena = ReturnType<typeof createArena>;

export type PlayerView = {
  /** Public id, as used in profile links. */
  id: string;
  name: string;
  image: string | null;
  anonymous: boolean;
  /** The house bot, which never plays rated games. */
  bot: boolean;
  rating: number;
  online: boolean;
};

/** A game as one viewer sees it. Internal user ids never leave the server. */
export type MatchView = {
  /** Public id, as used in game links. */
  id: string;
  status: "waiting" | "active" | "finished" | "cancelled";
  private: boolean;
  /** Whether the game counts towards ratings, provided both players are signed in. */
  rated: boolean;
  /** The viewer's seat, or null for spectators. */
  seat: Player | null;
  players: Record<Player, PlayerView | null>;
  moves: LoggedMove[];
  winner: Player | null;
  endReason: "line" | "draw" | "resign" | "abandon" | null;
  /** Rating changes once a rated game is over; null until then, and for unrated games. */
  ratingDelta: Record<Player, number> | null;
  /**
   * Whether the players have moved so much rating between them lately that
   * this game's change was cut short, or left the game unrated.
   */
  ratingCapped: boolean;
  /** The seat that offered a rematch, while the other has not accepted. */
  rematchOffer: Player | null;
  /** Public id of the rematch, once both players agreed to it. */
  rematchId: string | null;
  /**
   * For the player in a game against the bot: the public game they are still
   * waiting in for a match, and whether someone has joined it and it is on.
   * Null for everyone else, and once that game is over or cancelled.
   */
  search: { id: string; found: boolean } | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/** A finished game, from the point of view of one of its players. */
export type HistoryEntry = {
  /** Public id, as used in game links. */
  id: string;
  private: boolean;
  seat: Player;
  /** Null if the opponent's account has since been deleted. */
  opponent: Pick<PlayerView, "id" | "name" | "image" | "anonymous" | "bot"> | null;
  result: "win" | "loss" | "draw";
  endReason: "line" | "draw" | "resign" | "abandon";
  /** Null for unrated games. */
  ratingDelta: number | null;
  moveCount: number;
  finishedAt: Date;
};

export type HistoryPage = {
  games: HistoryEntry[];
  /** Pass as `after` to get the next page; null on the last page. */
  next: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  /** Public id, as used in profile links. */
  id: string;
  name: string;
  image: string | null;
  rating: number;
};

/** Where a player's rating stood at a point in time. */
export type RatingPoint = { at: Date; rating: number };

export type Profile = {
  /** Public id, as used in profile links. */
  id: string;
  name: string;
  image: string | null;
  anonymous: boolean;
  bot: boolean;
  joinedAt: Date;
  rating: number;
  /** Place on the leaderboard; null for guests and players yet to finish a rated game. */
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
  /**
   * The rating before the first rated game shown, then after every rated game
   * since, oldest first. Empty until the player finishes a rated game.
   */
  ratings: RatingPoint[];
};

type GameRow = typeof gameTable.$inferSelect;
/** What is published to watchers: the shared view plus who sits where, and what only players see. */
type Snapshot = {
  view: Omit<MatchView, "seat" | "search">;
  seats: Record<Player, string | null>;
  search: MatchView["search"];
};
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Postgres channel carrying the public ids of games that changed. */
const CHANNEL = "arena";

/** How many of a player's most recent games their rating trend covers. */
const RATING_POINTS = 500;

/** A game that ends with fewer moves than this is unrated, like an abort. */
const RATED_MIN_MOVES = 2;

/** Internal id of the house bot's user, created the first time someone plays it. */
export const BOT_ID = "bot";
const BOT_NAME = "thicc bot";

export type ArenaOptions = {
  db: Database;
  /** Public games older than this are not offered by matchmaking. */
  matchmakingWindowMs?: number;
  /** How long a waiting game survives after its creator disconnects. */
  abandonGraceMs?: number;
  /** How often this instance refreshes its presence and sweeps up dead games. */
  heartbeatMs?: number;
  /** Presence not refreshed for this long belongs to an instance that died. */
  staleMs?: number;
  /** Cancelled games nobody played are deleted this long after they were opened. */
  unplayedRetentionMs?: number;
  /**
   * An active game nobody has moved in for this long is lost by the player to
   * move, if they have been gone this long too.
   */
  forfeitAfterMs?: number;
  /** Chooses the house bot's moves. */
  bot?: Bot;
  /** How long the bot appears to think before each move. */
  botDelayMs?: () => number;
  /** A bot turn left unplayed this long, say by an instance that died, is played by the next sweep. */
  botStallMs?: number;
};

export function createArena({
  db,
  matchmakingWindowMs = 10 * 60_000,
  abandonGraceMs = 30_000,
  heartbeatMs = 5_000,
  staleMs = 20_000,
  unplayedRetentionMs = 24 * 60 * 60_000,
  forfeitAfterMs = 2 * 60_000,
  bot = fallbackBot,
  botDelayMs = () => 500 + Math.random() * 1_000,
  botStallMs = 15_000,
}: ArenaOptions) {
  const publisher = new EventPublisher<Record<string, Snapshot>>();
  /** gameId -> open watch streams on this instance */
  const watching = new Map<string, number>();
  /** Presence rows of this instance's watch streams, by id. */
  const connections = new Map<string, { gameId: string; userId: string }>();
  /** gameId -> pending delivery, so snapshots go out in the order they were read */
  const deliveries = new Map<string, Promise<void>>();
  const closing = new AbortController();

  /** Bot turns this instance is playing, by game id and how many moves came before. */
  const botTurns = new Set<string>();

  const ago = (ms: number) => sql`now() - make_interval(secs => ${ms / 1000})`;
  const fresh = and(isNull(presence.leftAt), gt(presence.seenAt, ago(staleMs)));
  /** Games against the bot played while waiting in the public game being queried. */
  const botGame = alias(gameTable, "bot_game");
  const botGamesMeanwhile = eq(botGame.searchId, gameTable.publicId);
  /** Who shows up on the leaderboard: signed-in players who have finished a rated game. */
  const ranked = and(
    eq(user.isAnonymous, false),
    eq(user.isBot, false),
    gt(sql`${playerStats.wins} + ${playerStats.losses} + ${playerStats.draws}`, 0),
  );
  /** Leaderboard order. The id is never shown; it keeps players who joined in the same instant apart. */
  const standing = [
    desc(playerStats.rating),
    desc(playerStats.wins),
    asc(user.createdAt),
    asc(user.id),
  ];
  const finishedBy = (userId: string) =>
    and(
      eq(gameTable.status, "finished"),
      or(eq(gameTable.playerX, userId), eq(gameTable.playerO, userId)),
    );

  async function snapshot(gameId: string): Promise<Snapshot> {
    const row = await db.query.game.findFirst({ where: { publicId: gameId } });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Game not found" });

    const ids = [row.playerX, row.playerO].filter((id) => id !== null);
    const [players, online] = ids.length
      ? await Promise.all([
          db
            .select({
              id: user.id,
              publicId: user.publicId,
              name: user.name,
              image: user.image,
              anonymous: user.isAnonymous,
              bot: user.isBot,
              rating: playerStats.rating,
            })
            .from(user)
            .leftJoin(playerStats, eq(playerStats.userId, user.id))
            .where(inArray(user.id, ids)),
          db
            .selectDistinct({ userId: presence.userId })
            .from(presence)
            .where(and(eq(presence.gameId, gameId), fresh)),
        ])
      : [[], []];
    const seat = (userId: string | null): PlayerView | null => {
      const found = players.find((p) => p.id === userId);
      if (!found) return null;
      return {
        id: found.publicId,
        name: found.name,
        image: found.image,
        anonymous: found.anonymous ?? false,
        bot: found.bot,
        rating: found.rating ?? 1000,
        // The bot never connects, but it is always there.
        online: found.bot || online.some((p) => p.userId === found.id),
      };
    };

    return {
      view: {
        id: row.publicId,
        status: row.status,
        private: row.private,
        rated: row.rated,
        players: { X: seat(row.playerX), O: seat(row.playerO) },
        moves: row.moves,
        winner: row.winner,
        endReason: row.endReason,
        ratingDelta: row.ratingDelta,
        ratingCapped: row.ratingCapped,
        rematchOffer: row.rematchOffer,
        rematchId: row.rematchId,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      },
      seats: { X: row.playerX, O: row.playerO },
      search: await searchOf(row.searchId),
    };
  }

  /** Where the player of a game against the bot stands in their search for a match. */
  async function searchOf(searchId: string | null): Promise<MatchView["search"]> {
    if (!searchId) return null;
    const [found] = await db
      .select({ status: gameTable.status })
      .from(gameTable)
      .where(eq(gameTable.publicId, searchId));
    if (found?.status !== "waiting" && found?.status !== "active") return null;
    return { id: searchId, found: found.status === "active" };
  }

  function forViewer({ view, seats, search }: Snapshot, viewerId: string | null): MatchView {
    const seat =
      viewerId === null ? null : seats.X === viewerId ? "X" : seats.O === viewerId ? "O" : null;
    return { ...view, seat, search: seat ? search : null };
  }

  async function view(gameId: string, viewerId: string | null): Promise<MatchView> {
    return forViewer(await snapshot(gameId), viewerId);
  }

  /** Tells every instance, this one included, that the game changed. */
  async function broadcast(gameId: string) {
    await db.execute(sql`select pg_notify(${CHANNEL}, ${gameId})`);
  }

  /** Pushes the game's current state to its watchers on this instance. */
  function deliver(gameId: string) {
    if (!watching.has(gameId)) return;
    const delivery: Promise<void> = (deliveries.get(gameId) ?? Promise.resolve())
      .then(async () => publisher.publish(gameId, await snapshot(gameId)))
      .catch((error) => console.error("delivery failed", error))
      .finally(() => {
        if (deliveries.get(gameId) === delivery) deliveries.delete(gameId);
      });
    deliveries.set(gameId, delivery);
  }

  /** Holds a connection that LISTENs for changes, reconnecting if it drops. */
  function listen() {
    const { promise: ready, resolve } = Promise.withResolvers<void>();
    let current: PoolClient | undefined;

    // Destroyed rather than returned to the pool, which would keep it listening.
    function drop(client: PoolClient, error?: Error) {
      if (current !== client) return;
      current = undefined;
      client.release(error ?? true);
      if (error && !closing.signal.aborted) {
        console.error("arena listener lost", error);
        setTimeout(connect, 1_000);
      }
    }

    async function connect() {
      if (closing.signal.aborted) return;
      const client = await db.$client.connect().catch((error: Error) => {
        console.error("arena listener failed to connect", error);
        setTimeout(connect, 1_000);
      });
      if (!client) return;
      if (closing.signal.aborted) return client.release(true);
      current = client;
      client.on("notification", ({ payload }) => payload && deliver(payload));
      client.on("error", (error) => drop(client, error));
      try {
        await client.query(`listen ${CHANNEL}`);
      } catch (error) {
        return drop(client, error as Error);
      }
      resolve();
      // Anything announced while we were not listening was missed.
      for (const gameId of watching.keys()) deliver(gameId);
    }

    void connect();
    return { ready, stop: () => current && drop(current) };
  }

  const listener = listen();

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

  /**
   * Serializes a player's game openings across every instance, so two requests
   * at once can't each find no open game and both open one.
   */
  async function lockHost(tx: Tx, userId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`host:${userId}`}, 0))`);
  }

  /** The game of this kind this player opened that is still waiting for an opponent, if any. */
  async function waitingOf(tx: Tx, userId: string, isPrivate: boolean, rated: boolean) {
    const [own] = await tx
      .select({ id: gameTable.publicId })
      .from(gameTable)
      .where(
        and(
          eq(gameTable.status, "waiting"),
          eq(gameTable.private, isPrivate),
          eq(gameTable.rated, rated),
          eq(gameTable.createdBy, userId),
        ),
      )
      .limit(1);
    return own?.id;
  }

  async function create(tx: Tx, userId: string, isPrivate: boolean, rated: boolean) {
    await ensureStats(tx, userId);
    const seat: Player = Math.random() < 0.5 ? "X" : "O";
    const [row] = await tx
      .insert(gameTable)
      .values({
        private: isPrivate,
        rated,
        createdBy: userId,
        playerX: seat === "X" ? userId : null,
        playerO: seat === "O" ? userId : null,
      })
      .returning({ publicId: gameTable.publicId });
    return row!.publicId;
  }

  /**
   * Seats the second player. Returns the ids of the bot games the host played
   * while waiting in a public game, whose player is to be told that the match
   * was found.
   */
  async function seat(tx: Tx, row: GameRow, userId: string) {
    await ensureStats(tx, userId);
    await tx
      .update(gameTable)
      .set({
        status: "active",
        startedAt: new Date(),
        playerX: row.playerX ?? userId,
        playerO: row.playerO ?? userId,
      })
      .where(eq(gameTable.id, row.id));
    if (row.private) return [];
    await lockSearch(tx, row.publicId);
    return tx
      .select({ gameId: gameTable.publicId })
      .from(gameTable)
      .where(eq(gameTable.searchId, row.publicId));
  }

  /**
   * Serializes starting a game against the bot with the match it was played
   * meanwhile being found, so a bot game can't start just after.
   */
  async function lockSearch(tx: Tx, searchId: string) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`search:${searchId}`}, 0))`,
    );
  }

  /** The status of the public game a player waits in, held that way until `tx` ends. */
  async function searchStatus(tx: Tx, searchId: string) {
    await lockSearch(tx, searchId);
    const [found] = await tx
      .select({ status: gameTable.status })
      .from(gameTable)
      .where(eq(gameTable.publicId, searchId));
    return found?.status;
  }

  async function ensureBot(tx: Tx) {
    await tx
      .insert(user)
      .values({
        id: BOT_ID,
        name: BOT_NAME,
        email: "bot@thicctactoe.invalid",
        isBot: true,
        onboarded: true,
      })
      .onConflictDoNothing();
  }

  /** Starts a game against the bot, which is never rated. Its opponent always plays X. */
  async function openBotGame(tx: Tx, userId: string, searchId: string | null) {
    await ensureBot(tx);
    const [row] = await tx
      .insert(gameTable)
      .values({
        status: "active",
        startedAt: new Date(),
        private: true,
        rated: false,
        createdBy: userId,
        playerX: userId,
        playerO: BOT_ID,
        searchId,
      })
      .returning({ publicId: gameTable.publicId });
    return row!.publicId;
  }

  /**
   * A player who shows up for their match stops the bot games they played
   * while waiting for it. Called off rather than lost, they count for nothing.
   */
  async function leaveBotGames(match: Snapshot["view"], userId: string) {
    if (match.private || match.status !== "active") return [];
    return db
      .update(gameTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(gameTable.searchId, match.id),
          eq(gameTable.playerX, userId),
          eq(gameTable.status, "active"),
        ),
      )
      .returning({ gameId: gameTable.publicId });
  }

  const isBotGame = (row: GameRow) => row.playerX === BOT_ID || row.playerO === BOT_ID;

  async function isGuest(tx: Tx, userId: string) {
    const [found] = await tx
      .select({ anonymous: user.isAnonymous })
      .from(user)
      .where(eq(user.id, userId));
    return found?.anonymous ?? false;
  }

  /**
   * Whether a game counts towards ratings and records: a rated game between
   * two signed-in players that both of them moved in. Unrated friend games,
   * guests, the bot, games against yourself and games resigned before they
   * began can't be used to farm rating.
   */
  async function isRated(tx: Tx, row: GameRow, moves: LoggedMove[]) {
    if (!row.rated || moves.length < RATED_MIN_MOVES) return false;
    // Fewer than two players means one sat in both seats, like a guest merged into the account they played.
    const players = await tx
      .select({ anonymous: user.isAnonymous, bot: user.isBot })
      .from(user)
      .where(inArray(user.id, [row.playerX!, row.playerO!]));
    return players.length === 2 && players.every((player) => !player.anonymous && !player.bot);
  }

  /** The rating `userId` has gained from `opponentId`, net, within the cap's window. */
  async function gainedFrom(tx: Tx, userId: string, opponentId: string) {
    const gain = sql`case when ${gameTable.playerX} = ${userId} then (${gameTable.ratingDelta} ->> 'X')::int else (${gameTable.ratingDelta} ->> 'O')::int end`;
    const [row] = await tx
      .select({ gained: sql<number>`coalesce(sum(${gain}), 0)`.mapWith(Number) })
      .from(gameTable)
      .where(
        and(
          eq(gameTable.status, "finished"),
          isNotNull(gameTable.ratingDelta),
          gt(gameTable.finishedAt, new Date(Date.now() - PAIR_RATING_WINDOW_MS)),
          or(
            and(eq(gameTable.playerX, userId), eq(gameTable.playerO, opponentId)),
            and(eq(gameTable.playerX, opponentId), eq(gameTable.playerO, userId)),
          ),
        ),
      );
    return row!.gained;
  }

  /**
   * Ends the game and, if it is rated, applies rating changes and records the
   * result. `winner` null means a draw. How much rating can move between the
   * same two players is capped; a game with nothing left to move is unrated.
   */
  async function finish(
    tx: Tx,
    row: GameRow,
    winner: Player | null,
    endReason: "line" | "draw" | "resign" | "abandon",
    moves: LoggedMove[] = row.moves,
  ) {
    let ratingDelta: Record<Player, number> | null = null;
    let ratingCapped = false;
    if (await isRated(tx, row, moves)) {
      const x = row.playerX!;
      const o = row.playerO!;
      // Locked in a fixed order, so games between the same two players that
      // finish at once queue up here, and each reads their history below only
      // once the one before it has committed.
      const stats = await tx
        .select()
        .from(playerStats)
        .where(inArray(playerStats.userId, [x, o]))
        .orderBy(asc(playerStats.userId))
        .for("update");
      const ratingOf = (id: string) => stats.find((s) => s.userId === id)?.rating ?? 1000;
      const scoreX = winner === "X" ? 1 : winner === "O" ? 0 : 0.5;
      const full = ratingChange(ratingOf(x), ratingOf(o), scoreX);
      const deltaX = capPairChange(full, await gainedFrom(tx, x, o));
      ratingCapped = deltaX !== full;
      // With nothing left to move under the cap, the game is unrated.
      if (deltaX !== 0 || !ratingCapped) {
        ratingDelta = { X: deltaX, O: -deltaX };
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
      }
    }

    await tx
      .update(gameTable)
      .set({
        status: "finished",
        moves,
        winner,
        endReason,
        ratingDelta,
        ratingCapped,
        finishedAt: new Date(),
      })
      .where(eq(gameTable.id, row.id));
    // Whoever still plays the bot while this match waited for them learns it is over, once it commits.
    if (!row.private) {
      await tx.execute(
        sql`select pg_notify(${CHANNEL}, ${gameTable.publicId}) from ${gameTable} where ${gameTable.searchId} = ${row.publicId}`,
      );
    }
  }

  /**
   * Plays a move the rules allow, finishing the game if it ends it. Returns
   * how many moves have been played, and whether it is now the bot's turn.
   */
  async function apply(tx: Tx, row: GameRow, move: Move) {
    const result = play(replay(row.moves), move);
    if (!result.ok) throw new ORPCError("CONFLICT", { message: result.error });

    const moves = [...row.moves, { ...move, at: new Date().toISOString() }];
    const { outcome, turn } = result.game;
    if (outcome.status === "won") await finish(tx, row, outcome.winner, "line", moves);
    else if (outcome.status === "draw") await finish(tx, row, null, "draw", moves);
    else await tx.update(gameTable).set({ moves }).where(eq(gameTable.id, row.id));
    return {
      ply: moves.length,
      botToMove: outcome.status === "playing" && row[`player${turn}`] === BOT_ID,
    };
  }

  const isBotTurn = (row: GameRow, ply: number) =>
    row.status === "active" &&
    row.moves.length === ply &&
    row[`player${replay(row.moves).turn}`] === BOT_ID;

  /**
   * Plays the bot's move in a game where it is the bot's turn after `ply`
   * moves, after a moment to think. Instances may race to play the same
   * turn; only the first move counts.
   */
  async function botTurn(gameId: string, ply: number) {
    const key = `${gameId}:${ply}`;
    if (botTurns.has(key) || closing.signal.aborted) return;
    botTurns.add(key);
    try {
      const row = await db.query.game.findFirst({ where: { publicId: gameId } });
      if (!row || !isBotTurn(row, ply)) return;
      const [move] = await Promise.all([
        bot.chooseMove(row.moves),
        sleep(botDelayMs(), undefined, { signal: closing.signal }),
      ]);
      const moved = await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (!isBotTurn(row, ply)) return false;
        await apply(tx, row, move);
        return true;
      });
      if (moved) await broadcast(gameId);
    } catch (error) {
      // Closing cuts the thought short; another instance plays the turn.
      if (!closing.signal.aborted) console.error("bot move failed", gameId, error);
    } finally {
      botTurns.delete(key);
    }
  }

  /** Plays the bot turns nobody has, like those of an instance that died mid-thought. */
  async function resumeBotTurns() {
    const ply = sql<number>`jsonb_array_length(${gameTable.moves})`.mapWith(Number);
    const stuck = await db
      .select({ gameId: gameTable.publicId, ply })
      .from(gameTable)
      .where(
        and(
          eq(gameTable.status, "active"),
          lt(gameTable.updatedAt, ago(botStallMs)),
          or(
            and(eq(gameTable.playerX, BOT_ID), sql`${ply} % 2 = 0`),
            and(eq(gameTable.playerO, BOT_ID), sql`${ply} % 2 = 1`),
          ),
        ),
      );
    for (const { gameId, ply } of stuck) void botTurn(gameId, ply);
  }

  /** Marks a player as watching; returns the presence id to release later. */
  async function connect(gameId: string, userId: string) {
    const id = crypto.randomUUID();
    await db.insert(presence).values({ id, gameId, userId });
    connections.set(id, { gameId, userId });
    return id;
  }

  async function disconnect(ids: string[]) {
    for (const id of ids) connections.delete(id);
    if (!ids.length) return [];
    return db
      .update(presence)
      .set({ leftAt: sql`now()` })
      .where(and(inArray(presence.id, ids), isNull(presence.leftAt)))
      .returning({ gameId: presence.gameId });
  }

  async function broadcastAll(rows: { gameId: string }[]) {
    await Promise.all([...new Set(rows.map((row) => row.gameId))].map(broadcast));
  }

  /**
   * Refreshes this instance's presence, then cleans up after every instance:
   * players whose instance died go offline, a waiting game nobody has watched
   * for a while is cancelled, since it would strand whoever joins it (playing
   * the bot meanwhile counts as watching), an active game whose player to
   * move has left is lost by them, bot turns nobody played get played, and
   * cancelled games nobody played are eventually deleted.
   */
  async function sweep() {
    const back = await refresh();
    const lost = await db
      .update(presence)
      .set({ leftAt: sql`${presence.seenAt}` })
      .where(and(isNull(presence.leftAt), lt(presence.seenAt, ago(staleMs))))
      .returning({ gameId: presence.gameId });
    const abandoned = await db
      .update(gameTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(gameTable.status, "waiting"),
          lt(gameTable.createdAt, ago(abandonGraceMs)),
          notExists(
            db
              .select()
              .from(presence)
              .where(
                and(
                  or(
                    eq(presence.gameId, gameTable.publicId),
                    inArray(
                      presence.gameId,
                      db.select({ id: botGame.publicId }).from(botGame).where(botGamesMeanwhile),
                    ),
                  ),
                  or(isNull(presence.leftAt), gt(presence.leftAt, ago(abandonGraceMs))),
                ),
              ),
          ),
        ),
      )
      .returning({ gameId: gameTable.publicId });
    const forfeited = await forfeitAbandoned();
    await resumeBotTurns();
    // Kept long enough to tell how long a player has been gone.
    await db
      .delete(presence)
      .where(lt(presence.leftAt, ago(Math.max(abandonGraceMs, forfeitAfterMs))));
    // Nobody played them, so nothing about them is worth keeping.
    await db
      .delete(gameTable)
      .where(
        and(
          eq(gameTable.status, "cancelled"),
          isNull(gameTable.startedAt),
          lt(gameTable.createdAt, ago(unplayedRetentionMs)),
        ),
      );
    await broadcastAll([...back, ...lost, ...abandoned, ...forfeited]);
  }

  /**
   * Refreshes this instance's presence. If it stalled for long enough that
   * another instance took its players for gone, or even swept their rows up,
   * their streams are still open, so they are back.
   */
  async function refresh() {
    const ids = [...connections.keys()];
    if (!ids.length) return [];
    const seen = await db
      .update(presence)
      .set({ seenAt: sql`now()` })
      .where(and(inArray(presence.id, ids), isNull(presence.leftAt)))
      .returning({ id: presence.id });
    const back = await db
      .update(presence)
      .set({ seenAt: sql`now()`, leftAt: null })
      .where(and(inArray(presence.id, ids), isNotNull(presence.leftAt)))
      .returning({ id: presence.id, gameId: presence.gameId });
    const found = new Set([...seen, ...back].map((row) => row.id));
    for (const id of ids) {
      const live = connections.get(id);
      if (found.has(id) || !live) continue;
      await db
        .insert(presence)
        .values({ id, ...live })
        .onConflictDoNothing()
        .then(
          () => back.push({ id, gameId: live.gameId }),
          // Its game or player is gone too.
          (error) => console.error("presence restore failed", error),
        );
    }
    // A stream that closed meanwhile stays gone.
    const closed = await disconnect(ids.filter((id) => !connections.has(id)));
    return [...back, ...closed];
  }

  /** Ends the active games that have stalled because the player to move left. */
  async function forfeitAbandoned() {
    const stalled = and(
      eq(gameTable.status, "active"),
      lt(gameTable.updatedAt, ago(forfeitAfterMs)),
    );
    const candidates = await db
      .select({ gameId: gameTable.publicId })
      .from(gameTable)
      .where(stalled);
    const forfeited: { gameId: string }[] = [];
    for (const { gameId } of candidates) {
      const ended = await db
        .transaction(async (tx) => {
          // Checked again under the lock, in case a move or another instance got there first.
          const [row] = await tx
            .select()
            .from(gameTable)
            .where(and(eq(gameTable.publicId, gameId), stalled))
            .for("update");
          if (!row) return false;
          const absent = replay(row.moves).turn;
          const userId = row[`player${absent}`];
          // The bot is always there; a turn it has not played yet is resumed instead.
          if (userId === BOT_ID) return false;
          if (userId) {
            const [seen] = await tx
              .select({ id: presence.id })
              .from(presence)
              .where(
                and(
                  eq(presence.gameId, gameId),
                  eq(presence.userId, userId),
                  or(isNull(presence.leftAt), gt(presence.leftAt, ago(forfeitAfterMs))),
                ),
              )
              .limit(1);
            if (seen) return false;
          }
          await finish(tx, row, other(absent), "abandon");
          return true;
        })
        // One game failing must not hold up the rest of the sweep.
        .catch((error) => {
          console.error("forfeit failed", gameId, error);
          return false;
        });
      if (ended) forfeited.push({ gameId });
    }
    return forfeited;
  }

  /** The internal id of the player with this public id. */
  async function userIdOf(playerId: string) {
    const [found] = await db.select({ id: user.id }).from(user).where(eq(user.publicId, playerId));
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Player not found" });
    return found.id;
  }

  /** Where a ranked player places, counted over the leaderboard's own order. */
  async function rankOf(tx: Tx, userId: string) {
    const standings = tx
      .select({
        id: user.id,
        rank: sql<number>`row_number() over (order by ${sql.join(standing, sql`, `)})`
          .mapWith(Number)
          .as("rank"),
      })
      .from(playerStats)
      .innerJoin(user, eq(user.id, playerStats.userId))
      .where(ranked)
      .as("standings");
    const [row] = await tx
      .select({ rank: standings.rank })
      .from(standings)
      .where(eq(standings.id, userId));
    return row!.rank;
  }

  /** Walks back from the current rating through the player's recent rated games. */
  async function ratingsOf(tx: Tx, userId: string, current: number): Promise<RatingPoint[]> {
    // Both seats count: merging a guest into an account they played can seat them twice.
    const change = (player: Player) =>
      sql`case when ${gameTable[`player${player}`]} = ${userId} then coalesce((${gameTable.ratingDelta} ->> ${player})::int, 0) else 0 end`;
    const rows = await tx
      .select({
        startedAt: gameTable.startedAt,
        finishedAt: gameTable.finishedAt,
        delta: sql<number>`${change("X")} + ${change("O")}`,
      })
      .from(gameTable)
      .where(and(finishedBy(userId), isNotNull(gameTable.ratingDelta)))
      .orderBy(desc(gameTable.finishedAt), desc(gameTable.id))
      .limit(RATING_POINTS);
    let rating = current;
    const points = rows.map((row) => {
      const point = { at: row.finishedAt!, rating };
      rating -= row.delta;
      return point;
    });
    const first = rows.at(-1);
    if (first) points.push({ at: first.startedAt ?? first.finishedAt!, rating });
    return points.reverse();
  }

  const heartbeat = setInterval(
    () => void sweep().catch((error) => console.error("presence sweep failed", error)),
    heartbeatMs,
  );
  heartbeat.unref();

  return {
    view,

    /** Joins the oldest open public game, or opens a new one. Returns its id. */
    async quickMatch(userId: string): Promise<string> {
      const { id, joined } = await db.transaction(async (tx) => {
        await lockHost(tx, userId);
        const own = await waitingOf(tx, userId, false, true);
        if (own) return { id: own, joined: null };
        const recent = new Date(Date.now() - matchmakingWindowMs);

        const [open] = await tx
          .select()
          .from(gameTable)
          .where(
            and(
              eq(gameTable.status, "waiting"),
              eq(gameTable.private, false),
              or(ne(gameTable.createdBy, userId), isNull(gameTable.createdBy)),
              // A host still playing the bot while they wait is still around.
              or(
                gt(gameTable.createdAt, recent),
                exists(
                  tx
                    .select({ id: botGame.id })
                    .from(botGame)
                    .where(and(botGamesMeanwhile, gt(botGame.updatedAt, recent))),
                ),
              ),
            ),
          )
          .orderBy(asc(gameTable.createdAt))
          .limit(1)
          .for("update", { skipLocked: true });
        if (open) return { id: open.publicId, joined: await seat(tx, open, userId) };
        return { id: await create(tx, userId, false, true), joined: null };
      });
      if (joined) await broadcastAll([{ gameId: id }, ...joined]);
      return id;
    },

    /**
     * Opens a private game that only people with the link can join, or returns
     * the one of the same kind this player already has waiting. Only signed-in
     * players can open a rated one.
     */
    async invite(userId: string, rated = false): Promise<string> {
      return db.transaction(async (tx) => {
        if (rated && (await isGuest(tx, userId))) {
          throw new ORPCError("FORBIDDEN", { message: "Sign in to play rated games" });
        }
        await lockHost(tx, userId);
        return (await waitingOf(tx, userId, true, rated)) ?? create(tx, userId, true, rated);
      });
    },

    async join(gameId: string, userId: string): Promise<MatchView> {
      const joined = await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (seatOf(row, userId)) return null;
        if (row.status !== "waiting") {
          throw new ORPCError("CONFLICT", { message: "This game already has two players" });
        }
        if (row.private && row.rated && (await isGuest(tx, userId))) {
          throw new ORPCError("FORBIDDEN", { message: "Sign in to accept a rated game" });
        }
        return seat(tx, row, userId);
      });
      if (joined) await broadcastAll([{ gameId }, ...joined]);
      return view(gameId, userId);
    },

    /**
     * Starts a game against the bot for a player waiting in a public game,
     * who stays in the queue meanwhile: once someone joins that game, they are
     * told, and the bot game is called off when they go to it. Asking again
     * returns the bot game in progress.
     */
    async playBot(searchId: string, userId: string): Promise<string> {
      return db.transaction(async (tx) => {
        await lockSearch(tx, searchId);
        const [search] = await tx.select().from(gameTable).where(eq(gameTable.publicId, searchId));
        if (!search) throw new ORPCError("NOT_FOUND", { message: "Game not found" });
        if (search.private || search.createdBy !== userId) {
          throw new ORPCError("FORBIDDEN", { message: "You are not waiting for this match" });
        }
        if (search.status !== "waiting") {
          throw new ORPCError("CONFLICT", { message: "This match has already started" });
        }
        const [current] = await tx
          .select({ id: gameTable.publicId })
          .from(gameTable)
          .where(and(eq(gameTable.searchId, searchId), eq(gameTable.status, "active")))
          .limit(1);
        return current?.id ?? openBotGame(tx, userId, searchId);
      });
    },

    async move(gameId: string, userId: string, move: Move): Promise<MatchView> {
      const { ply, botToMove } = await db.transaction(async (tx) => {
        const row = await lock(tx, gameId);
        if (row.status !== "active") {
          throw new ORPCError("CONFLICT", { message: "This game is not in progress" });
        }
        if (seatOf(row, userId) !== move.player) {
          throw new ORPCError("FORBIDDEN", { message: "That is not your piece" });
        }
        return apply(tx, row, move);
      });
      await broadcast(gameId);
      if (botToMove) void botTurn(gameId, ply);
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
     * of the finished game learn its id. The bot accepts right away, and its
     * opponent keeps X.
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
        if (isBotGame(row)) {
          // The bot always accepts, and keeps waiting with its opponent if they still are.
          const search = row.searchId && (await searchStatus(tx, row.searchId));
          if (search === "active") {
            throw new ORPCError("CONFLICT", { message: "Your match has been found" });
          }
          const next = await openBotGame(tx, userId, search === "waiting" ? row.searchId : null);
          await tx.update(gameTable).set({ rematchId: next }).where(eq(gameTable.id, row.id));
          return;
        }
        if (row.rematchOffer !== other(seat)) {
          await tx.update(gameTable).set({ rematchOffer: seat }).where(eq(gameTable.id, row.id));
          return;
        }
        const [next] = await tx
          .insert(gameTable)
          .values({
            status: "active",
            startedAt: new Date(),
            private: row.private,
            rated: row.rated,
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
      await listener.ready;
      const updates = publisher.subscribe(gameId, {
        signal: signal ? AbortSignal.any([signal, closing.signal]) : closing.signal,
      });
      watching.set(gameId, (watching.get(gameId) ?? 0) + 1);
      let connection: string | undefined;
      try {
        const initial = await snapshot(gameId);
        if (userId !== null && forViewer(initial, userId).seat !== null) {
          // Announce the player as online; this stream receives that update too.
          connection = await connect(gameId, userId);
          const left = await leaveBotGames(initial.view, userId);
          await broadcastAll([{ gameId }, ...left]);
        } else {
          yield forViewer(initial, userId);
        }
        let status = initial.view.status;
        for await (const update of updates) {
          // A host who sees their match start here has shown up for it too.
          if (connection && status === "waiting" && update.view.status === "active") {
            await broadcastAll(await leaveBotGames(update.view, userId!));
          }
          status = update.view.status;
          yield forViewer(update, userId);
        }
      } catch (error) {
        // Closing ends the stream cleanly, so the client reconnects elsewhere.
        if (!closing.signal.aborted) throw error;
      } finally {
        // Unsubscribes even if the stream failed before it began reading updates.
        await updates.return();
        const count = watching.get(gameId)! - 1;
        if (count > 0) watching.set(gameId, count);
        else watching.delete(gameId);
        if (connection) {
          await disconnect([connection]);
          await broadcast(gameId).catch(() => {});
        }
      }
    },

    sweep,

    /**
     * Takes this instance out of live play before it shuts down: ends its
     * streams so clients reconnect to another instance, and marks its players
     * as gone right away instead of when their presence goes stale.
     */
    async close() {
      closing.abort();
      clearInterval(heartbeat);
      listener.stop();
      await broadcastAll(await disconnect([...connections.keys()]));
    },

    /** A player's record and rating trend, by public id. */
    async profile(playerId: string): Promise<Profile> {
      // One snapshot, so a game finishing mid-read can't split the record from the trend.
      return db.transaction(
        async (tx) => {
          const [found] = await tx
            .select({
              id: user.id,
              name: user.name,
              image: user.image,
              anonymous: user.isAnonymous,
              bot: user.isBot,
              createdAt: user.createdAt,
              rating: playerStats.rating,
              wins: playerStats.wins,
              losses: playerStats.losses,
              draws: playerStats.draws,
            })
            .from(user)
            .leftJoin(playerStats, eq(playerStats.userId, user.id))
            .where(eq(user.publicId, playerId));
          if (!found) throw new ORPCError("NOT_FOUND", { message: "Player not found" });

          const rating = found.rating ?? 1000;
          const wins = found.wins ?? 0;
          const losses = found.losses ?? 0;
          const draws = found.draws ?? 0;
          const anonymous = found.anonymous ?? false;
          const onBoard = !anonymous && !found.bot && wins + losses + draws > 0;

          return {
            id: playerId,
            name: found.name,
            image: found.image,
            anonymous,
            bot: found.bot,
            joinedAt: found.createdAt,
            rating,
            rank: onBoard ? await rankOf(tx, found.id) : null,
            wins,
            losses,
            draws,
            ratings: await ratingsOf(tx, found.id, rating),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    /** A player's finished games by public id, newest first. */
    async history(
      playerId: string,
      { after, limit = 20 }: { after?: string; limit?: number } = {},
    ): Promise<HistoryPage> {
      const userId = await userIdOf(playerId);
      // Ordered by (finishedAt, id) so games finished in the same instant still page cleanly.
      const anchor = after
        ? db
            .select({ finishedAt: gameTable.finishedAt, id: gameTable.id })
            .from(gameTable)
            .where(eq(gameTable.publicId, after))
        : undefined;
      const rows = await db
        .select({
          publicId: gameTable.publicId,
          private: gameTable.private,
          playerX: gameTable.playerX,
          playerO: gameTable.playerO,
          winner: gameTable.winner,
          endReason: gameTable.endReason,
          ratingDelta: gameTable.ratingDelta,
          moveCount: sql<number>`jsonb_array_length(${gameTable.moves})`,
          finishedAt: gameTable.finishedAt,
        })
        .from(gameTable)
        .where(
          and(
            finishedBy(userId),
            anchor && sql`(${gameTable.finishedAt}, ${gameTable.id}) < (${anchor})`,
          ),
        )
        .orderBy(desc(gameTable.finishedAt), desc(gameTable.id))
        .limit(limit + 1);
      const page = rows.slice(0, limit);

      const opponentIds = page
        .map((row) => (row.playerX === userId ? row.playerO : row.playerX))
        .filter((id) => id !== null);
      const opponents = opponentIds.length
        ? await db
            .select({
              id: user.id,
              publicId: user.publicId,
              name: user.name,
              image: user.image,
              anonymous: user.isAnonymous,
              bot: user.isBot,
            })
            .from(user)
            .where(inArray(user.id, opponentIds))
        : [];

      const games = page.map((row): HistoryEntry => {
        const seat: Player = row.playerX === userId ? "X" : "O";
        const opponentId = seat === "X" ? row.playerO : row.playerX;
        const opponent = opponents.find((o) => o.id === opponentId);
        return {
          id: row.publicId,
          private: row.private,
          seat,
          opponent: opponent
            ? {
                id: opponent.publicId,
                name: opponent.name,
                image: opponent.image,
                anonymous: opponent.anonymous ?? false,
                bot: opponent.bot,
              }
            : null,
          result: row.winner === null ? "draw" : row.winner === seat ? "win" : "loss",
          endReason: row.endReason!,
          ratingDelta: row.ratingDelta?.[seat] ?? null,
          moveCount: row.moveCount,
          finishedAt: row.finishedAt!,
        };
      });
      return { games, next: rows.length > limit ? page.at(-1)!.publicId : null };
    },

    /** Signed-in (non-anonymous) players who have finished at least one rated game. */
    async leaderboard(limit = 50): Promise<LeaderboardEntry[]> {
      const rows = await db
        .select({
          id: user.publicId,
          name: user.name,
          image: user.image,
          rating: playerStats.rating,
        })
        .from(playerStats)
        .innerJoin(user, eq(user.id, playerStats.userId))
        .where(ranked)
        .orderBy(...standing)
        .limit(limit);
      return rows.map((row, index) => ({ rank: index + 1, ...row }));
    },

    /**
     * Moves an anonymous player's games onto the account they signed in with,
     * before the anonymous user is deleted. Their rating and record stay
     * behind: a guest's games are never rated, but some from before were.
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
        await tx.delete(playerStats).where(eq(playerStats.userId, fromId));
        // A game still in progress can be rated now, and finishing it updates existing stats.
        await ensureStats(tx, toId);
      });
    },
  };
}
