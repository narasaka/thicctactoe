import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { authClient } from "./auth-client";

/**
 * The current session, signing in as a guest first if there is none, so
 * online play works without an account.
 */
export function useGuestSession() {
  const { data, isPending } = authClient.useSession();
  const signingIn = useRef(false);

  useEffect(() => {
    if (isPending || data || signingIn.current) return;
    signingIn.current = true;
    void authClient.signIn.anonymous().then(({ error }) => {
      signingIn.current = false;
      if (error) toast.error(`Could not start a guest session: ${error.message}`);
    });
  }, [data, isPending]);

  return data;
}
