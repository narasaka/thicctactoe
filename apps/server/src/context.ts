import { normalizeIP } from "@better-auth/core/utils/ip";
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
 * development, the socket's address is the client's. Like Better Auth, an
 * IPv6 client counts as its /64, which is usually all one household's.
 */
export function clientIp(context: HonoContext) {
  const address = context.req.header("x-real-ip") ?? socketAddress(context);
  return address ? normalizeIP(address) : "unknown";
}

function socketAddress(context: HonoContext) {
  try {
    return getConnInfo(context).remote.address;
  } catch {
    return undefined;
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
