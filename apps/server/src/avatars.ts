import { Avatar, Style } from "@dicebear/core";
import thumbs from "@dicebear/styles/thumbs.json" with { type: "json" };
import type { S3Client } from "bun";

const style = new Style(thumbs);

/**
 * Generated guest avatars, stored in the bucket and served from
 * `{publicUrl}/avatars/{userId}.svg` (Railway buckets are private).
 */
export function createAvatars({ bucket, publicUrl }: { bucket: S3Client; publicUrl: string }) {
  const key = (userId: string) => `avatars/${userId}.svg`;

  return {
    /** Generates and stores an avatar for the user; returns its URL. */
    async create(userId: string) {
      const svg = new Avatar(style, { seed: userId }).toString();
      await bucket.write(key(userId), svg, { type: "image/svg+xml" });
      return `${publicUrl.replace(/\/$/, "")}/${key(userId)}`;
    },

    async remove(userId: string) {
      await bucket.delete(key(userId));
    },

    /** Response for GET /avatars/:file, or null if there is no such avatar. */
    async serve(file: string) {
      const userId = file.match(/^([\w-]+)\.svg$/)?.[1];
      if (!userId) return null;
      const object = bucket.file(key(userId));
      if (!(await object.exists())) return null;
      return new Response(object.stream(), {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
        },
      });
    },
  };
}
