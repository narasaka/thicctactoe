import { afterEach, describe, expect, test } from "bun:test";
import { type Move, play, replay } from "@thicctactoe/game";

import { type Bot, createBot, fallbackBot } from "./bot";

const moves = (...cells: [Move["player"], Move["size"], number][]): Move[] =>
  cells.map(([player, size, cell]) => ({ player, size, cell }));

describe("fallback bot", () => {
  test("takes a winning move", async () => {
    // X to move, with two in the top row.
    const game = moves(["X", "small", 0], ["O", "small", 3], ["X", "small", 1], ["O", "small", 6]);
    for (let i = 0; i < 20; i++) {
      const move = await fallbackBot.chooseMove(game);
      const result = play(replay(game), move);
      expect(result.ok && result.game.outcome).toMatchObject({ status: "won", winner: "X" });
    }
  });

  test("blocks the opponent's immediate win", async () => {
    // O to move, and X threatens the top row.
    const game = moves(["X", "small", 0], ["O", "small", 4], ["X", "small", 1]);
    for (let i = 0; i < 20; i++) {
      const move = await fallbackBot.chooseMove(game);
      const result = play(replay(game), move);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const threat = play(result.game, { player: "X", size: "large", cell: 2 });
      expect(threat.ok && threat.game.outcome.status === "won").toBe(false);
    }
  });

  test("plays a legal move for whichever player is to move", async () => {
    for (const game of [[], moves(["X", "large", 4])]) {
      const move = await fallbackBot.chooseMove(game);
      expect(move.player).toBe(replay(game).turn);
      expect(play(replay(game), move).ok).toBe(true);
    }
  });
});

describe("bot service client", () => {
  const servers: ReturnType<typeof Bun.serve>[] = [];
  afterEach(() => {
    for (const server of servers.splice(0)) void server.stop(true);
  });

  /** A stand-in for the bot service; returns its URL and the requests it got. */
  function service(respond: (request: Request) => Response | Promise<Response>) {
    const requests: { auth: string | null; body: unknown }[] = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        requests.push({
          auth: request.headers.get("authorization"),
          body: await request.clone().json(),
        });
        return respond(request);
      },
    });
    servers.push(server);
    return { url: server.url.href, requests };
  }

  const FALLBACK: Move = { player: "O", size: "large", cell: 0 };
  const fallback: Bot = { chooseMove: async () => FALLBACK };
  const game = moves(["X", "small", 4]);
  const at = new Date().toISOString();

  test("asks the service for a move, with the token and the moves so far", async () => {
    const answer: Move = { player: "O", size: "medium", cell: 4 };
    const { url, requests } = service(() => Response.json({ move: answer }));
    const bot = createBot({ url, token: "secret", fallback });
    const logged = game.map((move) => ({ ...move, at }));
    expect(await bot.chooseMove(logged)).toEqual(answer);
    expect(requests).toEqual([{ auth: "Bearer secret", body: { moves: logged } }]);
  });

  test("falls back when the service errors, is slow, or answers with an illegal move", async () => {
    const answers = [
      () => new Response("down", { status: 503 }),
      () => Response.json({ nope: true }),
      // Not O's piece to play.
      () => Response.json({ move: { player: "X", size: "small", cell: 0 } }),
      // Covers a piece of the same size.
      () => Response.json({ move: { player: "O", size: "small", cell: 4 } }),
      () =>
        Bun.sleep(200).then(() => Response.json({ move: { player: "O", size: "small", cell: 0 } })),
    ];
    for (const answer of answers) {
      const { url } = service(answer);
      const bot = createBot({ url, token: "secret", fallback, timeoutMs: 50 });
      expect(await bot.chooseMove(game)).toEqual(FALLBACK);
    }
  });

  test("falls back when the service can't be reached", async () => {
    const bot = createBot({ url: "http://127.0.0.1:9", token: "secret", fallback });
    expect(await bot.chooseMove(game)).toEqual(FALLBACK);
  });

  test("is the fallback when the service is not configured", () => {
    expect(createBot({ fallback })).toBe(fallback);
    expect(createBot({ url: "http://127.0.0.1:9", fallback })).toBe(fallback);
  });
});
