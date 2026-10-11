import { bucket, defineRailway, github, postgres, preserve, project, service } from "railway/iac";

/**
 * Backend infrastructure: `railway config plan` to preview, `railway config apply`
 * to apply. App configuration lives in apps/server/.env.production (dotenvx);
 * the service only holds the key that decrypts it.
 */
export default defineRailway(() => {
  const db = postgres("postgres");
  const avatars = bucket("avatars", { region: "sjc" });

  const api = service("api", {
    // Deploys every push to main once CI passes.
    source: github("narasaka/thicctactoe", { branch: "main", checkSuites: true }),
    build: {
      builder: "RAILPACK",
      buildCommand: "bunx turbo run build --filter=server",
      watchPatterns: ["/apps/server/**", "/packages/**", "/bun.lock", "/package.json"],
    },
    preDeploy: "cd packages/db && bun run db:migrate:production",
    start: "cd apps/server && bun run start",
    healthcheck: "/",
    // Live game updates and presence are kept in memory: exactly one replica.
    replicas: 1,
    // api.thicctactoe.com is attached with `railway domain` (not supported in IaC yet).
    env: {
      PORT: "3000",
      // Set once with `railway variables --service api --set DOTENV_PRIVATE_KEY_PRODUCTION=…`
      // (the value is in the root .env.keys).
      DOTENV_PRIVATE_KEY_PRODUCTION: preserve(),
    },
  });

  return project("thicctactoe", { resources: [db, avatars, api] });
});
