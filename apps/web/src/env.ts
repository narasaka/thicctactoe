import { z } from "zod";

/** Public build-time configuration, loaded by dotenvx from `.env` / `.env.production`. */
export const ENV = z
  .object({
    VITE_SERVER_URL: z.url(),
  })
  .parse({
    VITE_SERVER_URL: import.meta.env.VITE_SERVER_URL,
  });
