import type { RouterClient } from "@orpc/server";
import { moveSchema } from "@thicctactoe/game";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

const gameInput = z.object({ id: z.string().min(1) });

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  arena: {
    quickMatch: protectedProcedure.handler(async ({ context }) => ({
      id: await context.arena.quickMatch(context.session.user.id),
    })),
    invite: protectedProcedure.handler(async ({ context }) => ({
      id: await context.arena.invite(context.session.user.id),
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
    rematch: protectedProcedure
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
    history: protectedProcedure
      .input(
        z
          .object({
            after: z.string().min(1).optional(),
            limit: z.number().int().min(1).max(50).default(20),
          })
          .optional(),
      )
      .handler(({ context, input }) => context.arena.history(context.session.user.id, input)),
    watch: publicProcedure
      .input(gameInput)
      .handler(({ context, input, signal }) =>
        context.arena.watch(input.id, context.session?.user.id ?? null, signal),
      ),
  },
  leaderboard: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .handler(({ context, input }) => context.arena.leaderboard(input?.limit)),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
