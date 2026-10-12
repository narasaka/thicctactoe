import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
});
