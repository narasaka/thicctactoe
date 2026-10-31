import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createDb } from "@thicctactoe/db";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createAuth } from "./index";

// Needs Postgres, e.g. `docker compose up -d`. Its own database, so it can run
// beside the API tests; the schema is wiped on every run.
const url = new URL(
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/thicctactoe_test",
);
url.pathname = `${url.pathname}_auth`;
const db = createDb({ DATABASE_URL: url.href });

beforeAll(async () => {
  const admin = createDb({
    DATABASE_URL: Object.assign(new URL(url), { pathname: "/postgres" }).href,
  });
  const name = url.pathname.slice(1);
  const { rowCount } = await admin.execute(sql`select 1 from pg_database where datname = ${name}`);
  if (!rowCount) await admin.execute(sql.raw(`create database "${name}"`));
  await admin.$client.end();
  await db.execute(sql`drop schema if exists public cascade; create schema public;`);
  await db.execute(sql`drop schema if exists drizzle cascade;`);
  await migrate(db, {
    migrationsFolder: new URL("../../db/src/migrations", import.meta.url).pathname,
  });
});

afterAll(() => db.$client.end());

/** A server instance; every one shares the database. */
const instance = () =>
  createAuth(
    {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars",
      CORS_ORIGIN: "http://localhost:3001",
    },
    db,
    { onGuestCreated: async () => {}, onGuestSignedIn: async () => {} },
  );

const signInAsGuest = (auth: ReturnType<typeof instance>, ip: string) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
        "x-real-ip": ip,
      },
      body: "{}",
    }),
  );

describe("rate limits", () => {
  test("count guest sign-ins from one IP in the database, across instances", async () => {
    const instances = [instance(), instance()];
    for (let i = 0; i < 30; i++) {
      expect((await signInAsGuest(instances[i % 2]!, "203.0.113.7")).status).toBe(200);
    }
    for (const auth of instances) {
      expect((await signInAsGuest(auth, "203.0.113.7")).status).toBe(429);
    }
    expect((await signInAsGuest(instances[0]!, "203.0.113.8")).status).toBe(200);
    // In Postgres rather than one process's memory, so separate servers share them.
    const { rows } = await db.execute<{ count: number }>(sql`select count from rate_limit`);
    expect(rows.map((row) => row.count).sort((a, b) => a - b)).toEqual([1, 30]);
  });
});
