import { z } from "zod";

/** Server configuration, loaded by dotenvx from `.env` / `.env.production`. */
export const ENV = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().min(1),
    S3_ENDPOINT: z.url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_REGION: z.string().default("us-east-1"),
    // Railway buckets need virtual-hosted-style URLs.
    S3_VIRTUAL_HOSTED_STYLE: z.stringbool().default(false),
    // A social provider is enabled only when both of its values are set.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    // The bot service plays the bot's moves when both are set; otherwise a simple built-in bot does.
    // A URL that isn't one, like a reference to a service not deployed yet, falls back too.
    BOT_URL: z
      .url()
      .optional()
      .catch(({ input }) => {
        console.error(`BOT_URL ${JSON.stringify(input)} is not a URL; the built-in bot plays`);
        return undefined;
      }),
    BOT_TOKEN: z.string().optional(),
  })
  .parse(process.env);
