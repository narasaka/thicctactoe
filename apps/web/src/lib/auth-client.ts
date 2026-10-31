import type { Auth } from "@thicctactoe/auth";
import { anonymousClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [anonymousClient(), inferAdditionalFields<Auth>()],
});

export type Provider = "google" | "github";

export const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
];

/**
 * Signs in with OAuth, coming back to the current page or to `returnTo`; a
 * guest's games carry over to the account.
 */
export function signInWith(provider: Provider, returnTo?: string) {
  const callbackURL = returnTo
    ? new URL(returnTo, window.location.href).href
    : window.location.href;
  void authClient.signIn.social({ provider, callbackURL }).then(({ error }) => {
    if (error) toast.error(error.message ?? "Sign in failed");
  });
}
