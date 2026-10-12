import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createDb } from "@thicctactoe/db";
import { game as gameTable, playerStats, user } from "@thicctactoe/db/schema/index";
import type { Move } from "@thicctactoe/game";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { type MatchView, createArena } from "./arena";

// Needs Postgres, e.g. `docker compose up -d`. The schema is wiped on every run.
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/thicctactoe_test";
const db = createDb({ DATABASE_URL });
let arena = createArena({ db });

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
  arena = createArena({ db, abandonGraceMs: 10 });
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

    const { games, next } = await arena.history(O);
    expect(next).toBeNull();
    expect(games).toEqual([
      expect.objectContaining({
        id: resigned,
        opponent: { name: X, image: null, anonymous: false },
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
    expect((await arena.history(X)).games.map((game) => game.result)).toEqual(["loss", "win"]);
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

    const first = await arena.history(a, { limit: 2 });
    expect(first.games).toHaveLength(2);
    const second = await arena.history(a, { limit: 2, after: first.next! });
    expect([...first.games, ...second.games].map((game) => game.id).sort()).toEqual(ids.sort());
    expect(second.next).toBeNull();
  });
});

describe("ids", () => {
  test("games get short public ids; internal user ids never appear in views", async () => {
    const { id, X, O } = await startGame();
    expect(id).toMatch(/^[2-9a-km-np-z]{10}$/);
    await db.update(user).set({ name: "Somebody" });
    const json = JSON.stringify([await arena.view(id, X), await arena.leaderboard()]);
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
      expect.objectContaining({ rank: 1, name: X, rating: 1016, wins: 1 }),
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
    expect((await arena.view(id, null)).status).toBe("cancelled");
  });

  test("a waiting game survives while its host is watching", async () => {
    const host = await addUser("host");
    const id = await arena.invite(host);
    const stream = arena.watch(id, host);
    await stream.next();
    await Bun.sleep(50);
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
    expect((await arena.view(id, null)).status).toBe("cancelled");
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
