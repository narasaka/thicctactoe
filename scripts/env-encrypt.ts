/**
 * Encrypts env files with the repo's single root .env.keys.
 *
 *   bun run env:encrypt                       # every apps/<app>/.env and apps/<app>/.env.production
 *   bun run env:encrypt apps/web/.env ...     # only these files
 *
 * Values that are already encrypted are left as they are. A file without a
 * public key gets the one its environment already uses, so dotenvx never
 * mints a second keypair: every `.env` shares DOTENV_PRIVATE_KEY and every
 * `.env.production` shares DOTENV_PRIVATE_KEY_PRODUCTION.
 */
import { $, Glob } from "bun";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const KEYS = ".env.keys";
process.chdir(ROOT);

const allEnvFiles = ["apps/*/.env", "apps/*/.env.production"]
  .flatMap((pattern) => [...new Glob(pattern).scanSync({ cwd: ROOT, dot: true })])
  .sort();

const files = process.argv.length > 2 ? process.argv.slice(2) : allEnvFiles;

/** `.env` -> DOTENV_PUBLIC_KEY, `.env.production` -> DOTENV_PUBLIC_KEY_PRODUCTION */
function publicKeyName(file: string) {
  const environment = basename(file).replace(/^\.env\.?/, "");
  return environment ? `DOTENV_PUBLIC_KEY_${environment.toUpperCase()}` : "DOTENV_PUBLIC_KEY";
}

function existingPublicKey(name: string) {
  for (const file of allEnvFiles) {
    const match = readFileSync(file, "utf8").match(new RegExp(`^${name}="?([0-9a-f]+)"?`, "m"));
    if (match) return match[1];
  }
  return null;
}

for (const file of files) {
  if (!existsSync(file)) throw new Error(`No such env file: ${file}`);
  const name = publicKeyName(file);
  const text = readFileSync(file, "utf8");
  const key = existingPublicKey(name);
  if (key && !new RegExp(`^${name}=`, "m").test(text)) {
    const hint = relative(dirname(file), KEYS);
    writeFileSync(
      file,
      [
        "#/-------------------[DOTENV_PUBLIC_KEY]--------------------/",
        "#/            public-key encryption for .env files          /",
        "#/       [how it works](https://dotenvx.com/encryption)     /",
        "#/----------------------------------------------------------/",
        `${name}="${key}" # -fk ${hint}`,
        "",
        text,
      ].join("\n"),
    );
  }
}

await $`dotenvx encrypt ${files.flatMap((file) => ["-f", file])} -fk ${KEYS} --no-native --no-armor`;
