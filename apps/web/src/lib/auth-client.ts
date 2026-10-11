import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [anonymousClient()],
});

export type Provider = "google" | "github";

/** Signs in with OAuth; a guest's games and stats carry over to the account. */
export function signInWith(provider: Provider) {
  return authClient.signIn.social({ provider, callbackURL: window.location.href });
}
