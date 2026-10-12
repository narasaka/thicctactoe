import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import type { AppRouterClient } from "@thicctactoe/api/routers/index";
import { toast } from "sonner";

import { failOnStall } from "@/lib/stall";

import { ENV } from "../env";

/**
 * The server sends a keepalive on open streams every 5 seconds (oRPC's
 * default), so a connection quiet for this long is dead.
 */
const STALL_MS = 15_000;

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        toast.error(`Error: ${error.message}`, {
          action: {
            label: "retry",
            onClick: () => {
              query.invalidate();
            },
          },
        });
      },
    }),
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });
}

const fetchUntilStalled = failOnStall(fetch, STALL_MS);

const link = new RPCLink({
  url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
  fetch(url, options) {
    return fetchUntilStalled(url, {
      ...options,
      credentials: "include",
    });
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
