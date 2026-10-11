import type { Context as ApiContext } from "@thicctactoe/api/context";
import type { Context as HonoContext } from "hono";

import { db } from "./services";
import { auth } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
