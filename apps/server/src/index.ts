import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@thicctactoe/api/routers/index";
import { createHash } from "node:crypto";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env";
import { auth, avatars } from "./services";

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

// TEMPORARY: shows which client IP headers reach the server through
// Railway's edge, with IPs hashed so none are exposed. Remove after use.
app.get("/debug/ip-headers", (c) => {
  const describe = (ip: string) => {
    const kind = ip.includes(":")
      ? "v6"
      : /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
        ? "private"
        : /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)
          ? "cgnat"
          : "public";
    return `${kind}:${createHash("sha256").update(ip).digest("hex").slice(0, 10)}`;
  };
  const headers: Record<string, string[] | string> = {};
  for (const [name, value] of c.req.raw.headers) {
    headers[name] =
      /^(x-real-ip|x-forwarded-for|forwarded|x-envoy-external-address|cf-connecting-ip|true-client-ip|x-client-ip|fastly-client-ip)$/.test(
        name,
      )
        ? value.split(",").map((ip) => describe(ip.trim()))
        : "(present)";
  }
  return c.json(headers);
});

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

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.text("OK");
});

export default app;
