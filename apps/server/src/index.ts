import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@thicctactoe/api/routers/index";
import { type Context, Hono, type Next } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { clientIp, createContext } from "./context";
import { ENV } from "./env";
import { auth, avatars, limits } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    // Cache preflights (browsers cap this, Chrome at two hours) so every RPC
    // after the first is one round trip instead of two.
    maxAge: 86_400,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.get("/avatars/:file", async (c) => (await avatars.serve(c.req.param("file"))) ?? c.notFound());

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// Both handlers serve the whole router. Only their paths look up the session,
// which costs a database query, and floods are turned away before it.
app.use("/rpc/*", limitRequests, serve(rpcHandler, "/rpc"));
app.use("/api-reference/*", limitRequests, serve(apiHandler, "/api-reference"));

async function limitRequests(c: Context, next: Next) {
  const result = limits.hit("requests", [`ip:${clientIp(c)}`]);
  if ("retryAfter" in result) {
    c.header("Retry-After", String(result.retryAfter));
    return c.json({ code: "TOO_MANY_REQUESTS", message: "Too many requests" }, 429);
  }
  await next();
}

function serve(handler: typeof rpcHandler | typeof apiHandler, prefix: `/${string}`) {
  return async (c: Context, next: Next) => {
    const context = await createContext({ context: c });
    const { matched, response } = await handler.handle(c.req.raw, { prefix, context });
    if (matched) return c.newResponse(response.body, response);
    await next();
  };
}

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
