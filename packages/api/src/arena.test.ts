import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "@thicctactoe/db";
import { game as gameTable, playerStats, user } from "@thicctactoe/db/schema/index";
import type { Move } from "@thicctactoe/game";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { type Arena, type ArenaOptions, type MatchView, createArena } from "./arena";

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

/** Starts a game between two fresh users; returns the users by seat. */
async function startGame() {
  const host = await addUser("host");
  const guest = await addUser("guest");
  const id = await arena.invite(host);
  const { seat } = await arena.join(id, guest);
  return seat === "X" ? { id, X: guest, O: host } : { id, X: host, O: guest };
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
    const { id, X, O } = await startGame();
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
    expect(next).toMatchObject({ status: "active", private: true, seat: "O", moves: [] });
    expect(next.startedAt).not.toBeNull();
    expect((await arena.view(next.id, O)).seat).toBe("X");
    // A late click joins the same rematch rather than starting another.
    expect((await arena.rematch(id, X)).rematchId).toBe(next.id);
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
    const { id: first, X, O } = await startGame();
    await arena.resign(first, O); // X: 1016
    const second = await arena.invite(X);
    await arena.join(second, O);
    await arena.resign(second, X); // X: 1016 - 17 = 999
    const third = await arena.invite(X);
    await arena.join(third, O);
    await arena.resign(third, O); // X: 999 + 16 = 1015

    const profile = await arena.profile(await publicIdOf(X));
    expect(profile).toMatchObject({ name: X, anonymous: false, wins: 2, losses: 1, draws: 0 });
    expect(profile.rating).toBe((await statsOf(X)).rating);
    expect(profile.ratings.map((point) => point.rating)).toEqual([1000, 1016, 999, profile.rating]);
    const times = profile.ratings.map((point) => point.at.getTime());
    expect(times).toEqual(times.toSorted((a, b) => a - b));
    expect(profile.rank).toBe(1);
    expect((await arena.profile(await publicIdOf(O))).rank).toBe(2);
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
    const { id, X, O } = await startGame();
    await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`${user.id} = ${X}`);
    await arena.resign(id, O);
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
    const { id, X, O } = await startGame();
    await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`${user.id} = ${O}`);
    await arena.resign(id, O);
    await addUser("idle");
    await db.insert(playerStats).values({ userId: "idle" });

    expect(await arena.leaderboard()).toEqual([
      { rank: 1, id: await publicIdOf(X), name: X, image: null, rating: 1016 },
    ]);
  });
});

describe("mergePlayers", () => {
  test("moves an anonymous player's games and record onto their account", async () => {
    const { id, X, O } = await startGame();
    await arena.resign(id, O); // X: 1016, 1 win
    const account = await addUser("account");
    const other = await addUser("other");
    const second = await arena.invite(account);
    await arena.join(second, other);
    await arena.resign(second, other); // account: 1016, 1 win

    await arena.mergePlayers(X, account);

    expect((await arena.view(id, account)).seat).not.toBeNull();
    expect(await statsOf(account)).toMatchObject({ rating: 1032, wins: 2 });
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
