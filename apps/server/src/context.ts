import type { Context as ApiContext } from "@thicctactoe/api/context";
import type { Context as HonoContext } from "hono";

import { arena, auth } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    arena,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
