import type { RouterClient } from "@orpc/server";
import { moveSchema } from "@thicctactoe/game";
import { z } from "zod";

import { gameOpeningProcedure, protectedProcedure, publicProcedure } from "../index";
import { clientsOf } from "../limits";

const gameInput = z.object({ id: z.string().min(1) });

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  arena: {
    quickMatch: gameOpeningProcedure.handler(async ({ context }) => ({
      id: await context.arena.quickMatch(context.session.user.id),
    })),
    invite: gameOpeningProcedure
      // Optional, so clients from before rated invites keep working.
      .input(z.object({ rated: z.boolean().default(false) }).optional())
      .handler(async ({ context, input }) => ({
        id: await context.arena.invite(context.session.user.id, input?.rated),
      })),
    join: protectedProcedure
      .input(gameInput)
      .handler(({ context, input }) => context.arena.join(input.id, context.session.user.id)),
    move: protectedProcedure
      .input(gameInput.extend({ move: moveSchema }))
      .handler(({ context, input }) =>
        context.arena.move(input.id, context.session.user.id, input.move),
      ),
    resign: protectedProcedure
      .input(gameInput)
      .handler(({ context, input }) => context.arena.resign(input.id, context.session.user.id)),
    rematch: gameOpeningProcedure
      .input(gameInput)
      .handler(({ context, input }) => context.arena.rematch(input.id, context.session.user.id)),
    cancel: protectedProcedure
      .input(gameInput)
      .handler(({ context, input }) => context.arena.cancel(input.id, context.session.user.id)),
    view: publicProcedure
      .input(gameInput)
      .handler(({ context, input }) =>
        context.arena.view(input.id, context.session?.user.id ?? null),
      ),
    watch: publicProcedure
      .input(gameInput)
      .use(({ context, next }) => {
        context.limits.take("watches", clientsOf(context));
        return next();
      })
      // The slot is taken once the stream starts, so its `finally` always gives it back.
      .handler(async function* ({ context, input, signal }) {
        const release = context.limits.openStream(clientsOf(context));
        try {
          yield* context.arena.watch(input.id, context.session?.user.id ?? null, signal);
        } finally {
          release();
        }
      }),
  },
  players: {
    profile: publicProcedure
      .input(z.object({ id: z.string().min(1) }))
      .handler(({ context, input }) => context.arena.profile(input.id)),
    history: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          after: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(50).default(20),
        }),
      )
      .handler(({ context, input: { id, ...page } }) => context.arena.history(id, page)),
  },
  leaderboard: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .handler(({ context, input }) => context.arena.leaderboard(input?.limit)),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
