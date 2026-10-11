import { Avatar, Style } from "@dicebear/core";
import thumbs from "@dicebear/styles/thumbs.json" with { type: "json" };
import { publicId } from "@thicctactoe/db/public-id";
import type { S3Client } from "bun";

const style = new Style(thumbs);
const FILE = /^[2-9a-km-np-z]{10}\.svg$/;

/**
 * Generated guest avatars, stored in the bucket under a random public id and
 * served from `{publicUrl}/avatars/{id}.svg` (Railway buckets are private).
 */
export function createAvatars({ bucket, publicUrl }: { bucket: S3Client; publicUrl: string }) {
  const base = `${publicUrl.replace(/\/$/, "")}/avatars/`;

  return {
    /** Generates and stores a new avatar; returns its URL. */
    async create() {
      const file = `${publicId()}.svg`;
      const svg = new Avatar(style, { seed: file }).toString();
      await bucket.write(`avatars/${file}`, svg, { type: "image/svg+xml" });
      return base + file;
    },

    /** Deletes an avatar created here, given its URL; other images are ignored. */
    async remove(url: string | null | undefined) {
      const file = url?.startsWith(base) ? url.slice(base.length) : null;
      if (file && FILE.test(file)) await bucket.delete(`avatars/${file}`);
    },

    /** Response for GET /avatars/:file, or null if there is no such avatar. */
    async serve(file: string) {
      if (!FILE.test(file)) return null;
      const object = bucket.file(`avatars/${file}`);
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
