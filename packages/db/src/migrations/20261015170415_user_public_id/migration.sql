ALTER TABLE "user" ADD COLUMN "public_id" text;--> statement-breakpoint
-- Existing players get an id from the same alphabet as `publicId()` in public-id.ts.
UPDATE "user" SET "public_id" = (
	SELECT string_agg(substr('23456789abcdefghijkmnpqrstuvwxyz', floor(random() * 32)::int + 1, 1), '')
	FROM generate_series(1, 10)
	-- Correlated, so every row draws its own id.
	WHERE "user"."id" IS NOT NULL
);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_public_id_key" UNIQUE("public_id");
