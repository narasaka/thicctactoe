import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@thicctactoe/db";
import * as schema from "@thicctactoe/db/schema/auth";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";

import { guestName } from "./names";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

export type AuthHooks = {
  /** A guest was just created (e.g. give them an avatar). */
  onGuestCreated: (userId: string) => Promise<void>;
  /**
   * A guest signed in with a real account. Move their data to `userId`
   * now: the guest user is deleted right after this resolves.
   */
  onGuestSignedIn: (guestId: string, userId: string) => Promise<void>;
};

/**
 * Guests play without signing in (better-auth's anonymous plugin). Signing in
 * with Google or GitHub turns a guest into a real account; social providers
 * whose credentials are not configured are left out.
 */
export function createAuth(env: AuthConfig, database: Database, hooks: AuthHooks) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID &&
        env.GOOGLE_CLIENT_SECRET && {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            prompt: "select_account" as const,
          },
        }),
      ...(env.GITHUB_CLIENT_ID &&
        env.GITHUB_CLIENT_SECRET && {
          github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
        }),
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (user.isAnonymous) await hooks.onGuestCreated(user.id);
          },
        },
      },
    },
    plugins: [
      anonymous({
        generateName: guestName,
        onLinkAccount: ({ anonymousUser, newUser }) =>
          hooks.onGuestSignedIn(anonymousUser.user.id, newUser.user.id),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
