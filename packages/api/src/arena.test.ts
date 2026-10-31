import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "@thicctactoe/db";
import { game as gameTable, playerStats, user } from "@thicctactoe/db/schema/index";
import type { Move } from "@thicctactoe/game";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { call } from "@orpc/server";

import { type Arena, type ArenaOptions, type MatchView, createArena } from "./arena";
import type { Context } from "./context";
import { type Limits, createLimits } from "./limits";
import { appRouter } from "./routers/index";

// Needs Postgres, e.g. `docker compose up -d`. The schema is wiped on every run.
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/thicctactoe_test";
const db = createDb({ DATABASE_URL });
/** Every arena a test starts, as if each were its own server instance. */
const arenas: Arena[] = [];
const start = (options: Omit<ArenaOptions, "db"> = {}) => {
  const instance = createArena({ db, abandonGraceMs: 10, heartbeatMs: 60_000, ...options });
  arenas.push(instance);
  return instance;
};
let arena: Arena;

beforeAll(async () => {
  await createDatabaseIfMissing(DATABASE_URL);
  await db.execute(sql`drop schema if exists public cascade; create schema public;`);
  await db.execute(sql`drop schema if exists drizzle cascade;`);
  await migrate(db, {
    migrationsFolder: new URL("../../db/src/migrations", import.meta.url).pathname,
  });
});

afterAll(() => db.$client.end());

beforeEach(async () => {
  await db.execute(sql`truncate table "user", game cascade`);
  arena = start();
});

afterEach(async () => {
  await Promise.all(arenas.splice(0).map((instance) => instance.close()));
});

async function addUser(id: string, anonymous = false) {
  await db.insert(user).values({ id, name: id, email: `${id}@test.dev`, isAnonymous: anonymous });
  return id;
}

/** Starts a matchmade game between two users; returns the users by seat. */
async function match(a: string, b: string) {
  const id = await arena.quickMatch(a);
  expect(await arena.quickMatch(b)).toBe(id);
  const { seat } = await arena.view(id, a);
  return seat === "X" ? { id, X: a, O: b } : { id, X: b, O: a };
}

/** Starts a matchmade game between two fresh users. */
async function startGame() {
  return match(await addUser("host"), await addUser("guest"));
}

/** Starts a friend game the host invited the friend to; returns the users by seat. */
async function befriend(host: string, friend: string, rated?: boolean) {
  const id = await arena.invite(host, rated);
  const { seat } = await arena.join(id, friend);
  return seat === "X" ? { id, X: friend, O: host } : { id, X: host, O: friend };
}

/** Both players move once, so the game is rated if nothing else rules it out. */
async function opening({ id, X, O }: { id: string; X: string; O: string }) {
  await arena.move(id, X, { player: "X", size: "small", cell: 0 });
  await arena.move(id, O, { player: "O", size: "small", cell: 8 });
}

/** The id the player goes by in profile links. */
const publicIdOf = async (userId: string) =>
  (await db.query.user.findFirst({ where: { id: userId } }))!.publicId;

const statsOf = async (userId: string) =>
  (await db.query.playerStats.findFirst({ where: { userId } }))!;

const WIN_FOR_X = (x: Move["player"]): Move[] => {
  const o = x === "X" ? "O" : "X";
  return [
    { player: x, size: "small", cell: 0 },
    { player: o, size: "small", cell: 3 },
    { player: x, size: "small", cell: 1 },
    { player: o, size: "small", cell: 4 },
    { player: x, size: "small", cell: 2 },
  ];
};

describe("matchmaking", () => {
  test("quick match pairs the next player with the oldest open game", async () => {
    const a = await addUser("a");
    const b = await addUser("b");
    const id = await arena.quickMatch(a);
    expect((await arena.view(id, a)).status).toBe("waiting");
    // Asking again while waiting returns the same game.
    expect(await arena.quickMatch(a)).toBe(id);

    expect(await arena.quickMatch(b)).toBe(id);
    const [forA, forB] = [await arena.view(id, a), await arena.view(id, b)];
    expect(forA.status).toBe("active");
    expect([forA.seat, forB.seat].sort()).toEqual(["O", "X"]);
  });

  test("private games are not offered by quick match", async () => {
    const a = await addUser("a");
    const b = await addUser("b");
    const invite = await arena.invite(a);
    expect(await arena.quickMatch(b)).not.toBe(invite);
  });

  test("a full game cannot be joined, but its players can rejoin", async () => {
    const { id, X } = await startGame();
    const late = await addUser("late");
    await expect(arena.join(id, late)).rejects.toThrow("already has two players");
    expect((await arena.join(id, X)).status).toBe("active");
  });

  test("only the host can cancel a waiting game", async () => {
    const host = await addUser("host");
    const other = await addUser("other");
    const id = await arena.invite(host);
    await expect(arena.cancel(id, other)).rejects.toThrow("Only the host");
    expect((await arena.cancel(id, host)).status).toBe("cancelled");
  });
});

describe("open games", () => {
  test("a player keeps one invite waiting, however often and wherever they ask", async () => {
    const host = await addUser("host");
    const other = start();
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => [arena.invite(host), other.invite(host)]).flat(),
    );
    expect(new Set(ids).size).toBe(1);
    // Once a friend joins, the next invite is a new game.
    await arena.join(ids[0]!, await addUser("friend"));
    expect(await arena.invite(host)).not.toBe(ids[0]);
  });

  test("asking for a quick match many times at once opens one game", async () => {
    const host = await addUser("host");
    const other = start();
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => [arena.quickMatch(host), other.quickMatch(host)]).flat(),
    );
    expect(new Set(ids).size).toBe(1);
  });

  test("cancelled games nobody played are deleted after a while", async () => {
    const cleaning = start({ unplayedRetentionMs: 20 });
    const unplayed = await cleaning.invite(await addUser("loner"));
    const played = await startGame();
    await arena.resign(played.id, played.O);
    await Bun.sleep(50);
    await cleaning.sweep(); // Cancels the invite nobody opened...
    await cleaning.sweep(); // ...which was opened long enough ago to go.
    await expect(cleaning.view(unplayed, null)).rejects.toThrow("Game not found");
    expect((await cleaning.view(played.id, null)).status).toBe("finished");
  });
});

describe("rated games", () => {
  test("matchmade games are rated", async () => {
    const { id, X } = await startGame();
    expect(await arena.view(id, X)).toMatchObject({ private: false, rated: true });
  });

  test("unrated friend games leave ratings, records and the leaderboard alone", async () => {
    const rated = await startGame();
    await opening(rated);
    await arena.resign(rated.id, rated.O);
    const { X, O } = rated;
    const before = [await statsOf(X), await statsOf(O)];

    const friendly = await befriend(X, O);
    const { id } = friendly;
    expect(await arena.view(id, null)).toMatchObject({ private: true, rated: false });
    await opening(friendly);
    expect(await arena.resign(id, X)).toMatchObject({ status: "finished", ratingDelta: null });

    expect([await statsOf(X), await statsOf(O)]).toEqual(before);
    const profile = await arena.profile(await publicIdOf(X));
    expect(profile.ratings.map((point) => point.rating)).toEqual([1000, 1016]);
    expect((await arena.history(await publicIdOf(X))).games[0]).toMatchObject({
      id,
      private: true,
      result: "loss",
      ratingDelta: null,
    });
  });

  test("rated friend games between signed-in players change ratings", async () => {
    const host = await addUser("host");
    const friend = await addUser("friend");
    const started = await befriend(host, friend, true);
    expect(await arena.view(started.id, null)).toMatchObject({ private: true, rated: true });
    await opening(started);
    expect(await arena.resign(started.id, started.O)).toMatchObject({
      winner: "X",
      ratingDelta: { X: 16, O: -16 },
    });
    expect(await statsOf(started.X)).toMatchObject({ rating: 1016, wins: 1 });
    expect(await statsOf(started.O)).toMatchObject({ rating: 984, losses: 1 });
    expect((await arena.leaderboard()).map((entry) => entry.name)).toEqual([started.X, started.O]);
  });

  test("a host can keep a rated and an unrated invite waiting, and the friend gets the one they were sent", async () => {
    const host = await addUser("host");
    const unrated = await arena.invite(host);
    const rated = await arena.invite(host, true);
    expect(rated).not.toBe(unrated);
    expect(await arena.invite(host, true)).toBe(rated);
    expect(await arena.invite(host)).toBe(unrated);
    expect((await arena.join(rated, await addUser("friend"))).rated).toBe(true);
  });

  test("guests can't accept or open rated invites, but can play unrated ones", async () => {
    const host = await addUser("host");
    const guest = await addUser("guest", true);
    const rated = await arena.invite(host, true);
    await expect(arena.join(rated, guest)).rejects.toThrow("Sign in to accept a rated game");
    expect((await arena.view(rated, null)).status).toBe("waiting");
    // Once they sign in, they can.
    await db
      .update(user)
      .set({ isAnonymous: false })
      .where(sql`${user.id} = ${guest}`);
    expect((await arena.join(rated, guest)).status).toBe("active");

    const other = await addUser("other", true);
    expect((await arena.join(await arena.invite(host), other)).status).toBe("active");
    await expect(arena.invite(other, true)).rejects.toThrow("Sign in to play rated games");
  });

  test("the invite route opens a rated invite only when asked to", async () => {
    const host = await addUser("host");
    const context: Context = {
      arena,
      limits: createLimits(),
      ip: "203.0.113.1",
      session: { user: { id: host } } as Context["session"],
    };
    const rated = await call(appRouter.arena.invite, { rated: true }, { context });
    expect((await arena.view(rated.id, null)).rated).toBe(true);
    const unrated = await call(appRouter.arena.invite, undefined, { context });
    expect((await arena.view(unrated.id, null)).rated).toBe(false);
  });

  test("games with a guest are unrated", async () => {
    const started = await startGame();
    await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`${user.id} = ${started.O}`);
    await opening(started);
    expect(await arena.resign(started.id, started.O)).toMatchObject({ ratingDelta: null });
    expect(await statsOf(started.X)).toMatchObject({ rating: 1000, wins: 0 });
    expect(await statsOf(started.O)).toMatchObject({ rating: 1000, losses: 0 });
    expect(await arena.leaderboard()).toEqual([]);
  });

  test("a game resigned before both players moved is unrated", async () => {
    const { id, X, O } = await startGame();
    await arena.move(id, X, { player: "X", size: "small", cell: 4 });
    expect(await arena.resign(id, O)).toMatchObject({ winner: "X", ratingDelta: null });
    expect(await statsOf(X)).toMatchObject({ rating: 1000, wins: 0 });
  });
});

describe("limits", () => {
  const contextOf = (limits: Limits, userId: string | null, ip = "203.0.113.1"): Context => ({
    arena,
    limits,
    ip,
    session: userId ? ({ user: { id: userId } } as Context["session"]) : null,
  });

  test("players and IPs may only open so many games a minute", async () => {
    const limits = createLimits({ games: { max: 2, windowMs: 60_000 } });
    const [a, b] = [await addUser("a"), await addUser("b")];
    const quickMatch = (userId: string, ip?: string) =>
      call(appRouter.arena.quickMatch, undefined, { context: contextOf(limits, userId, ip) });
    await quickMatch(a);
    await quickMatch(a);
    // The player is out of games, wherever they ask from...
    await expect(quickMatch(a, "203.0.113.2")).rejects.toThrow("Too many requests");
    // ...and so is their IP, whoever asks from it.
    await expect(quickMatch(b)).rejects.toThrow("Too many requests");
    await quickMatch(b, "203.0.113.3");
  });

  test("a client may only watch so many games at once, and every closed stream frees its slot", async () => {
    const limits = createLimits({ streamsPerClient: 2 });
    const { id } = await startGame();
    const watch = (gameId = id) =>
      call(appRouter.arena.watch, { id: gameId }, { context: contextOf(limits, null) });

    const [a, b] = [await watch(), await watch()];
    await a.next();
    await b.next();
    await expect((await watch()).next()).rejects.toThrow("Too many open games");

    await a.return(undefined);
    // A stream that fails gives its slot back too.
    await expect((await watch("nope")).next()).rejects.toThrow("Game not found");
    const c = await watch();
    expect((await c.next()).done).toBe(false);
    await b.return(undefined);
    await c.return(undefined);
  });
});

describe("moves", () => {
  test("players may only move their own pieces, in turn", async () => {
    const { id, X, O } = await startGame();
    await expect(arena.move(id, O, { player: "X", size: "small", cell: 0 })).rejects.toThrow(
      "not your piece",
    );
    await expect(arena.move(id, O, { player: "O", size: "small", cell: 0 })).rejects.toThrow(
      "not_your_turn",
    );
    const game = await arena.move(id, X, { player: "X", size: "small", cell: 0 });
    expect(game.moves).toHaveLength(1);
  });

  test("a winning move finishes the game and updates ratings", async () => {
    const { id, X, O } = await startGame();
    let game: MatchView | undefined;
    for (const move of WIN_FOR_X("X")) {
      game = await arena.move(id, move.player === "X" ? X : O, move);
    }
    expect(game).toMatchObject({
      status: "finished",
      winner: "X",
      endReason: "line",
      ratingDelta: { X: 16, O: -16 },
    });
    expect(await statsOf(X)).toMatchObject({ rating: 1016, wins: 1, losses: 0 });
    expect(await statsOf(O)).toMatchObject({ rating: 984, wins: 0, losses: 1 });
  });

  test("resigning hands the win to the opponent", async () => {
    const started = await startGame();
    const { id, X, O } = started;
    await opening(started);
    const game = await arena.resign(id, X);
    expect(game).toMatchObject({ status: "finished", winner: "O", endReason: "resign" });
    expect(await statsOf(O)).toMatchObject({ wins: 1 });
  });
});

describe("rematch", () => {
  test("starts once both players agree, with colors swapped", async () => {
    const { id, X, O } = await startGame();
    await expect(arena.rematch(id, X)).rejects.toThrow("not over yet");
    await arena.resign(id, O);

    const offered = await arena.rematch(id, X);
    expect(offered).toMatchObject({ rematchOffer: "X", rematchId: null });
    // Offering again changes nothing; only the opponent can accept.
    expect(await arena.rematch(id, X)).toMatchObject({ rematchOffer: "X", rematchId: null });

    const accepted = await arena.rematch(id, O);
    expect(accepted.rematchOffer).toBeNull();
    const next = await arena.view(accepted.rematchId!, X);
    expect(next).toMatchObject({ status: "active", private: false, seat: "O", moves: [] });
    expect(next.startedAt).not.toBeNull();
    expect((await arena.view(next.id, O)).seat).toBe("X");
    // A late click joins the same rematch rather than starting another.
    expect((await arena.rematch(id, X)).rematchId).toBe(next.id);
  });

  test("keeps whether the game was private and rated", async () => {
    const host = await addUser("host");
    const friend = await addUser("friend");
    for (const rated of [true, false]) {
      const { id, X, O } = await befriend(host, friend, rated);
      await arena.resign(id, O);
      await arena.rematch(id, X);
      const { rematchId } = await arena.rematch(id, O);
      expect(await arena.view(rematchId!, X)).toMatchObject({ private: true, rated });
    }
    const { id, X, O } = await match(host, friend);
    await arena.resign(id, O);
    await arena.rematch(id, X);
    const { rematchId } = await arena.rematch(id, O);
    expect(await arena.view(rematchId!, X)).toMatchObject({ private: false, rated: true });
  });

  test("only the players can ask for one", async () => {
    const { id, O } = await startGame();
    await arena.resign(id, O);
    const late = await addUser("late");
    await expect(arena.rematch(id, late)).rejects.toThrow("not playing");
  });
});

describe("move log", () => {
  test("every move is logged with the time the server accepted it", async () => {
    const before = new Date();
    const { id, X, O } = await startGame();
    const moves = WIN_FOR_X("X");
    for (const move of moves) await arena.move(id, move.player === "X" ? X : O, move);

    const game = await arena.view(id, null);
    expect(game.moves).toMatchObject(moves);
    const times = game.moves.map((move) => new Date(move.at!).getTime());
    expect(times).toEqual([...times].sort());
    expect(game.startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(game.startedAt!.getTime()).toBeLessThanOrEqual(times[0]!);
    expect(game.finishedAt!.getTime()).toBeGreaterThanOrEqual(times.at(-1)!);
  });
});

describe("history", () => {
  test("lists a player's finished games, newest first, from their side", async () => {
    const { id: won, X, O } = await startGame();
    for (const move of WIN_FOR_X("X")) await arena.move(won, move.player === "X" ? X : O, move);
    const resigned = await arena.invite(X);
    await arena.join(resigned, O);
    await arena.resign(resigned, X);
    // Neither unfinished games nor other people's games are listed.
    await arena.invite(X);
    const stranger = await addUser("stranger");
    await arena.join(await arena.invite(stranger), await addUser("friend"));

    const { games, next } = await arena.history(await publicIdOf(O));
    expect(next).toBeNull();
    expect(games).toEqual([
      expect.objectContaining({
        id: resigned,
        opponent: { id: await publicIdOf(X), name: X, image: null, anonymous: false },
        result: "win",
        endReason: "resign",
        ratingDelta: null,
        moveCount: 0,
      }),
      expect.objectContaining({
        id: won,
        seat: "O",
        result: "loss",
        endReason: "line",
        ratingDelta: -16,
        moveCount: 5,
      }),
    ]);
    expect((await arena.history(await publicIdOf(X))).games.map((game) => game.result)).toEqual([
      "loss",
      "win",
    ]);
  });

  test("pages through games with a cursor", async () => {
    const a = await addUser("a");
    const b = await addUser("b");
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await arena.invite(a);
      await arena.join(id, b);
      await arena.resign(id, b);
      ids.push(id);
    }
    // Games finished in the same instant must neither repeat nor go missing.
    await db.update(gameTable).set({ finishedAt: new Date("2026-01-01") });

    const player = await publicIdOf(a);
    const first = await arena.history(player, { limit: 2 });
    expect(first.games).toHaveLength(2);
    const second = await arena.history(player, { limit: 2, after: first.next! });
    expect([...first.games, ...second.games].map((game) => game.id).sort()).toEqual(ids.sort());
    expect(second.next).toBeNull();
  });

  test("is not found for an unknown player", async () => {
    await expect(arena.history("nobody")).rejects.toThrow("Player not found");
  });
});

describe("profile", () => {
  test("shows a player's record, rank and rating after every game", async () => {
    const first = await startGame();
    const { X, O } = first;
    await opening(first);
    await arena.resign(first.id, O); // X: 1016
    const second = await match(X, O);
    await opening(second);
    await arena.resign(second.id, X); // X: 1016 - 17 = 999
    const third = await match(X, O);
    await opening(third);
    await arena.resign(third.id, O); // X: 999 + 16 = 1015

    const profile = await arena.profile(await publicIdOf(X));
    expect(profile).toMatchObject({ name: X, anonymous: false, wins: 2, losses: 1, draws: 0 });
    expect(profile.rating).toBe((await statsOf(X)).rating);
    expect(profile.ratings.map((point) => point.rating)).toEqual([1000, 1016, 999, profile.rating]);
    const times = profile.ratings.map((point) => point.at.getTime());
    expect(times).toEqual(times.toSorted((a, b) => a - b));
    expect(profile.rank).toBe(1);
    expect((await arena.profile(await publicIdOf(O))).rank).toBe(2);
  });

  test("ranks match the leaderboard even when everything else ties", async () => {
    const joinedAt = new Date("2026-01-01");
    for (const id of ["b", "a", "c"]) {
      await db.insert(user).values({ id, name: id, email: `${id}@test.dev`, createdAt: joinedAt });
      await db.insert(playerStats).values({ userId: id, draws: 1 });
    }
    for (const entry of await arena.leaderboard()) {
      expect((await arena.profile(entry.id)).rank).toBe(entry.rank);
    }
    expect((await arena.leaderboard()).map((entry) => entry.name)).toEqual(["a", "b", "c"]);
  });

  test("ranks match the leaderboard for players who joined within the same millisecond", async () => {
    for (const [id, joinedAt] of [
      ["a", "2026-01-01 00:00:00.123900"],
      ["b", "2026-01-01 00:00:00.123100"],
    ]) {
      await db.insert(user).values({ id: id!, name: id!, email: `${id}@test.dev` });
      await db.execute(sql`update "user" set created_at = ${joinedAt} where id = ${id}`);
      await db.insert(playerStats).values({ userId: id!, draws: 1 });
    }
    expect((await arena.leaderboard()).map((entry) => entry.name)).toEqual(["b", "a"]);
    for (const entry of await arena.leaderboard()) {
      expect((await arena.profile(entry.id)).rank).toBe(entry.rank);
    }
  });

  test("players who never finished a game have no rank or trend", async () => {
    const idle = await addUser("idle");
    expect(await arena.profile(await publicIdOf(idle))).toMatchObject({
      rating: 1000,
      rank: null,
      wins: 0,
      ratings: [],
    });
  });

  test("guests are not ranked", async () => {
    const started = await startGame();
    const { id, X, O } = started;
    await opening(started);
    await arena.resign(id, O);
    // Guests no longer play rated games, but ones from before still have a record.
    await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`${user.id} = ${X}`);
    expect(await arena.profile(await publicIdOf(X))).toMatchObject({ anonymous: true, rank: null });
    expect((await arena.profile(await publicIdOf(O))).rank).toBe(1);
  });

  test("is not found for an unknown player", async () => {
    await expect(arena.profile("nobody")).rejects.toThrow("Player not found");
  });
});

describe("ids", () => {
  test("games and players get short public ids; internal user ids never appear in views", async () => {
    const { id, X, O } = await startGame();
    await arena.resign(id, O);
    const player = await publicIdOf(X);
    expect(id).toMatch(/^[2-9a-km-np-z]{10}$/);
    expect(player).toMatch(/^[2-9a-km-np-z]{10}$/);
    await db.update(user).set({ name: "Somebody" });
    const json = JSON.stringify([
      await arena.view(id, X),
      await arena.leaderboard(),
      await arena.profile(player),
      await arena.history(player),
    ]);
    expect(json).not.toContain(X);
    expect(json).not.toContain(O);
  });

  test("each viewer sees their own seat", async () => {
    const { id, X, O } = await startGame();
    expect((await arena.view(id, X)).seat).toBe("X");
    expect((await arena.view(id, O)).seat).toBe("O");
    expect((await arena.view(id, null)).seat).toBeNull();
  });
});

describe("leaderboard", () => {
  test("ranks signed-in players who have played, excluding anonymous ones", async () => {
    const started = await startGame();
    const { id, X, O } = started;
    await opening(started);
    await arena.resign(id, O);
    await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`${user.id} = ${O}`);
    await addUser("idle");
    await db.insert(playerStats).values({ userId: "idle" });

    expect(await arena.leaderboard()).toEqual([
      { rank: 1, id: await publicIdOf(X), name: X, image: null, rating: 1016 },
    ]);
  });
});

describe("mergePlayers", () => {
  test("a game against yourself keeps only what the account lost", async () => {
    const started = await startGame();
    const { id, X, O } = started;
    await opening(started);
    await arena.resign(id, O); // X: 1016, O: 984
    // The guest who won was the account's owner in another browser.
    await arena.mergePlayers(X, O);

    expect(await arena.profile(await publicIdOf(O))).toMatchObject({
      rating: 984,
      wins: 0,
      losses: 1,
    });
  });

  test("moves an anonymous player's games, but not their rating or record, onto their account", async () => {
    const started = await startGame();
    const { id, X, O } = started;
    await opening(started);
    await arena.resign(id, O); // X: 1016, 1 win
    const account = await addUser("account");
    const second = await match(account, await addUser("other"));
    await opening(second);
    await arena.resign(second.id, second.X === account ? second.O : second.X); // account: 1016, 1 win

    await arena.mergePlayers(X, account);

    expect((await arena.view(id, account)).seat).not.toBeNull();
    expect(await statsOf(account)).toMatchObject({ rating: 1016, wins: 1, losses: 0 });
    expect(await db.query.playerStats.findFirst({ where: { userId: X } })).toBeUndefined();
  });
});

describe("abandoned games", () => {
  test("a waiting game nobody opens is cancelled", async () => {
    const host = await addUser("host");
    const id = await arena.quickMatch(host);
    await Bun.sleep(50);
    await arena.sweep();
    expect((await arena.view(id, null)).status).toBe("cancelled");
  });

  test("a waiting game survives while its host is watching", async () => {
    const host = await addUser("host");
    const id = await arena.invite(host);
    const stream = arena.watch(id, host);
    await stream.next();
    await Bun.sleep(50);
    await arena.sweep();
    expect((await arena.view(id, host)).status).toBe("waiting");
    await stream.return(undefined);
  });
});

describe("games left mid-play", () => {
  test("a game is lost by the player to move once they have been gone a while", async () => {
    const leaving = start({ forfeitAfterMs: 20 });
    const started = await startGame();
    await opening(started);
    const { id, X, O } = started;
    // O is still watching, but it is X's turn and X has left.
    const stream = leaving.watch(id, O);
    await stream.next();
    await Bun.sleep(50);
    await leaving.sweep();
    expect(await leaving.view(id, null)).toMatchObject({
      status: "finished",
      winner: "O",
      endReason: "abandon",
      ratingDelta: { X: -16, O: 16 },
    });
    expect(await statsOf(X)).toMatchObject({ losses: 1 });
    await stream.return(undefined);
  });

  test("a game survives while the player to move is watching, or has only just left", async () => {
    const leaving = start({ forfeitAfterMs: 500 });
    const started = await startGame();
    const watched = leaving.watch(started.id, started.X);
    await watched.next();
    await Bun.sleep(550);
    await leaving.sweep();
    expect((await leaving.view(started.id, null)).status).toBe("active");

    await watched.return(undefined);
    await leaving.sweep();
    expect((await leaving.view(started.id, null)).status).toBe("active");
  });

  test("a game survives an instance that stalled while its player kept watching", async () => {
    const owner = start();
    const started = await startGame();
    await opening(started);
    const watched = owner.watch(started.id, started.X);
    await watched.next();
    // The owner misses its heartbeats long enough for another instance to take X for gone...
    await Bun.sleep(50);
    await start({ staleMs: 20 }).sweep();
    expect((await owner.view(started.id, null)).players.X?.online).toBe(false);
    // ...then recovers, with X's stream still open.
    await owner.sweep();
    expect((await owner.view(started.id, null)).players.X?.online).toBe(true);
    await Bun.sleep(150);
    await start({ forfeitAfterMs: 100 }).sweep();
    expect((await owner.view(started.id, null)).status).toBe("active");
    await watched.return(undefined);
  });

  test("a game survives an instance that stalled until its player's presence was swept up", async () => {
    const owner = start();
    const started = await startGame();
    const watched = owner.watch(started.id, started.X);
    await watched.next();
    await arena.move(started.id, started.X, { player: "X", size: "small", cell: 0 });
    // While the owner stalls with O to move, another instance sweeps X's presence away.
    const other = start({ staleMs: 20, forfeitAfterMs: 100 });
    const opponent = other.watch(started.id, started.O);
    await opponent.next();
    await Bun.sleep(150);
    await other.sweep();
    await arena.move(started.id, started.O, { player: "O", size: "small", cell: 8 });
    // The owner recovers with X's stream still open, and now it is X's turn.
    await owner.sweep();
    expect((await owner.view(started.id, null)).players.X?.online).toBe(true);
    await Bun.sleep(150);
    await start({ forfeitAfterMs: 100 }).sweep();
    expect((await owner.view(started.id, null)).status).toBe("active");
    await watched.return(undefined);
    await opponent.return(undefined);
  });

  test("a game left before both players moved ends unrated", async () => {
    const leaving = start({ forfeitAfterMs: 20 });
    const { id, X } = await startGame();
    await arena.move(id, X, { player: "X", size: "small", cell: 4 });
    await Bun.sleep(50);
    await leaving.sweep();
    expect(await leaving.view(id, null)).toMatchObject({
      status: "finished",
      winner: "X",
      endReason: "abandon",
      ratingDelta: null,
    });
  });

  test("instances sweeping at once end the game once", async () => {
    const [a, b] = [start({ forfeitAfterMs: 20 }), start({ forfeitAfterMs: 20 })];
    const started = await startGame();
    await opening(started);
    await Bun.sleep(50);
    await Promise.all([a.sweep(), b.sweep(), a.sweep(), b.sweep()]);
    expect(await statsOf(started.X)).toMatchObject({ rating: 984, losses: 1 });
    expect(await statsOf(started.O)).toMatchObject({ rating: 1016, wins: 1 });
  });
});

describe("watch", () => {
  test("streams the current state, then every change, with presence", async () => {
    const { id, X } = await startGame();
    const controller = new AbortController();
    const stream = arena.watch(id, X, controller.signal);

    const first = await stream.next();
    expect(first.value).toMatchObject({ moves: [], players: { X: { online: true } } });

    const next = stream.next();
    await arena.move(id, X, { player: "X", size: "small", cell: 4 });
    expect((await next).value?.moves).toHaveLength(1);

    controller.abort();
    await stream.return(undefined);
    expect((await arena.view(id, null)).players.X?.online).toBe(false);
  });

  test("a waiting game is cancelled once its host stops watching", async () => {
    const host = await addUser("host");
    const id = await arena.quickMatch(host);
    const stream = arena.watch(id, host);
    await stream.next();
    await stream.return(undefined);

    await Bun.sleep(50);
    await arena.sweep();
    expect((await arena.view(id, null)).status).toBe("cancelled");
  });
});

describe("multiple instances", () => {
  test("watchers on one instance see changes made through another", async () => {
    const { id, X, O } = await startGame();
    const other = start();
    const stream = other.watch(id, O);
    expect((await stream.next()).value?.players.O?.online).toBe(true);

    const next = stream.next();
    await arena.move(id, X, { player: "X", size: "small", cell: 4 });
    expect((await next).value?.moves).toHaveLength(1);
    await stream.return(undefined);
  });

  test("players on an instance that died go offline, and their waiting game is cancelled", async () => {
    const host = await addUser("host");
    const dead = start({ staleMs: 20 });
    const id = await dead.invite(host);
    const stream = dead.watch(id, host);
    await stream.next();
    // It never refreshes its presence again, nor closes the stream.
    await Bun.sleep(50);

    const survivor = start({ staleMs: 20 });
    await survivor.sweep();
    const game = await survivor.view(id, null);
    expect(game.players.X?.online ?? game.players.O?.online).toBe(false);
    expect(game.status).toBe("cancelled");
  });

  test("closing an instance ends its streams and marks its players gone", async () => {
    const { id, X } = await startGame();
    const closing = start();
    const stream = closing.watch(id, X);
    await stream.next();

    await closing.close();
    expect((await stream.next()).done).toBe(true);
    expect((await arena.view(id, null)).players.X?.online).toBe(false);
  });
});

async function createDatabaseIfMissing(url: string) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  const admin = new Client({
    connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).href,
  });
  await admin.connect();
  const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (!rowCount) await admin.query(`create database "${name}"`);
  await admin.end();
}
