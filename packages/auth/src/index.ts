import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@thicctactoe/db";
import * as schema from "@thicctactoe/db/schema/auth";
import { betterAuth } from "better-auth";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
