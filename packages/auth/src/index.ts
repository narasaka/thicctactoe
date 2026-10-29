import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@thicctactoe/db";
import { publicId } from "@thicctactoe/db/public-id";
import * as schema from "@thicctactoe/db/schema/auth";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { anonymous } from "better-auth/plugins";

import { DISPLAY_NAME_MAX, displayName, guestName } from "./names";

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
  onGuestSignedIn: (guest: { id: string; image?: string | null }, userId: string) => Promise<void>;
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
    advanced: {
      // Railway's edge sets X-Real-IP to the client's address, replacing any
      // the client sent. Its X-Forwarded-For has a second, edge hop, which
      // the default (a single-entry X-Forwarded-For) rejects.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
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
    user: {
      additionalFields: {
        /** The id in profile links. */
        publicId: { type: "string", defaultValue: () => publicId(), input: false },
        /** Whether the player has picked a name since signing in for the first time. */
        onboarded: { type: "boolean", defaultValue: false, input: false },
      },
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
        update: {
          // Players may rename themselves through /update-user; nothing else
          // there is theirs to change (avatars are generated or come from the
          // provider).
          before: async (data, context) => {
            if (context?.path !== "/update-user") return;
            if (data.image !== undefined) {
              throw new APIError("BAD_REQUEST", { message: "Avatars can't be changed" });
            }
            if (data.name === undefined) return;
            const name = displayName(data.name);
            if (!name) {
              throw new APIError("BAD_REQUEST", {
                message: `Names must be 1 to ${DISPLAY_NAME_MAX} characters`,
              });
            }
            // Picking a name is all onboarding asks of a real account.
            const user = context.context.session?.user;
            const onboarded = !!user && !user.isAnonymous;
            return { data: { ...data, name, ...(onboarded && { onboarded }) } };
          },
        },
      },
    },
    plugins: [
      anonymous({
        generateName: guestName,
        onLinkAccount: ({ anonymousUser, newUser }) =>
          hooks.onGuestSignedIn(anonymousUser.user, newUser.user.id),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
