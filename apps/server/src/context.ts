import type { Context as ApiContext } from "@thicctactoe/api/context";
import type { Context as HonoContext } from "hono";
import { getConnInfo } from "hono/bun";

import { arena, auth, limits } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

/**
 * Railway's edge sets X-Real-IP to the client's address, replacing any the
 * client sent (the same header Better Auth trusts). Without the edge, as in
 * development, the socket's address is the client's.
 */
export function clientIp(context: HonoContext) {
  const header = context.req.header("x-real-ip");
  if (header) return header;
  try {
    return getConnInfo(context).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function createContext({ context }: CreateContextOptions): Promise<ApiContext> {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    arena,
    limits,
    session,
    ip: clientIp(context),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
