import { bucket, defineRailway, github, postgres, preserve, project, service } from "railway/iac";

/**
 * Backend infrastructure: `railway config plan` to preview, `railway config apply`
 * to apply. App configuration lives in apps/server/.env.production (dotenvx);
 * the service only holds the key that decrypts it.
 *
 * Only these resources: the bot service is managed from another repository, as
 * its own named partial.
 */
export const partial = "public";

export default defineRailway(() => {
  const db = postgres("postgres");
  const avatars = bucket("avatars", { region: "sjc" });

  const api = service("api", {
    // Deploys every push to main once CI passes.
    source: github("narasaka/thicctactoe", { branch: "main", checkSuites: true }),
    build: {
      builder: "RAILPACK",
      buildCommand: "bunx turbo run build --filter=server",
      // Only the server and the workspace packages it depends on; frontend-only
      // changes (apps/web, packages/ui) don't redeploy the API.
      watchPatterns: [
        "/apps/server/**",
        "/packages/api/**",
        "/packages/auth/**",
        "/packages/config/**",
        "/packages/db/**",
        "/packages/game/**",
        "/bun.lock",
        "/package.json",
        "/turbo.json",
      ],
    },
    preDeploy: "cd packages/db && bun run db:migrate:production",
    // `exec` so the shell Railway starts this in passes SIGTERM on to the server.
    start: "cd apps/server && exec bun run start",
    healthcheck: "/",
    // Live games are shared through Postgres, so instances can overlap or scale out.
    replicas: 1,
    deploy: {
      // Keep the old deployment up briefly after the new one takes traffic, then
      // give it time after SIGTERM to hand its live games over.
      overlapSeconds: 5,
      drainingSeconds: 10,
    },
    // api.thicctactoe.com is attached with `railway domain` (not supported in IaC yet).
    env: {
      PORT: "3000",
      // Set once with `railway variables --service api --set DOTENV_PRIVATE_KEY_PRODUCTION=…`
      // (the value is in the root .env.keys).
      DOTENV_PRIVATE_KEY_PRODUCTION: preserve(),
      // The bot service, over the private network. References, so the token is never copied.
      BOT_URL: "http://${{bot.RAILWAY_PRIVATE_DOMAIN}}:3000",
      BOT_TOKEN: "${{bot.BOT_TOKEN}}",
    },
  });

  return project("thicctactoe", { resources: [db, avatars, api] });
});
