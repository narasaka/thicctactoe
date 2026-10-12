import { createArena } from "@thicctactoe/api/arena";
import { createAuth } from "@thicctactoe/auth";
import { createDb } from "@thicctactoe/db";
import { user } from "@thicctactoe/db/schema/auth";
import { S3Client } from "bun";
import { eq } from "drizzle-orm";

import { createAvatars } from "./avatars";
import { ENV } from "./env";

export const db = createDb(ENV);
export const arena = createArena({ db });

// `bun --hot` re-runs this module in the same process: retire the previous arena.
const live = globalThis as { arena?: typeof arena };
if (live.arena) void live.arena.close();
else {
  // Railway sends SIGTERM once the next deployment is taking traffic. Hand live
  // games over to it before exiting.
  process.once("SIGTERM", () => {
    void live
      .arena!.close()
      .catch((error) => console.error("arena close failed", error))
      .finally(() => process.exit(0));
  });
}
live.arena = arena;

const bucket = new S3Client({
  accessKeyId: ENV.S3_ACCESS_KEY_ID,
  secretAccessKey: ENV.S3_SECRET_ACCESS_KEY,
  region: ENV.S3_REGION,
  bucket: ENV.S3_BUCKET,
  // Virtual-hosted buckets (Railway) put the bucket name in the hostname.
  ...(ENV.S3_VIRTUAL_HOSTED_STYLE
    ? {
        virtualHostedStyle: true,
        endpoint: ENV.S3_ENDPOINT.replace("://", `://${ENV.S3_BUCKET}.`),
      }
    : { endpoint: ENV.S3_ENDPOINT }),
});
export const avatars = createAvatars({ bucket, publicUrl: ENV.BETTER_AUTH_URL });

export const auth = createAuth(ENV, db, {
  async onGuestCreated(userId) {
    const image = await avatars.create();
    await db.update(user).set({ image }).where(eq(user.id, userId));
  },
  async onGuestSignedIn(guest, userId) {
    await arena.mergePlayers(guest.id, userId);
    await avatars
      .remove(guest.image)
      .catch((error) => console.error("avatar cleanup failed", error));
  },
});
