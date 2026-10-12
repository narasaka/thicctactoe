import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [anonymousClient()],
});

export type Provider = "google" | "github";

export const PROVIDERS: { id: Provider; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
];

/**
 * Signs in with OAuth, coming back to the current page; a guest's games and
 * stats carry over to the account.
 */
export function signInWith(provider: Provider) {
  void authClient.signIn
    .social({ provider, callbackURL: window.location.href })
    .then(({ error }) => {
      if (error) toast.error(error.message ?? "Sign in failed");
    });
}
