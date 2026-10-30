import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import { clientsOf } from "./limits";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

/** Opens a game, at a limited rate per player and per IP. */
export const gameOpeningProcedure = protectedProcedure.use(({ context, next }) => {
  context.limits.take("games", clientsOf(context));
  return next();
});
