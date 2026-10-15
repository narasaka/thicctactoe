-- Same alphabet and length as `publicId()` in public-id.ts.
CREATE FUNCTION "new_public_id"() RETURNS text LANGUAGE sql VOLATILE AS $$
	SELECT string_agg(substr('23456789abcdefghijkmnpqrstuvwxyz', floor(random() * 32)::int + 1, 1), '')
	FROM generate_series(1, 10)
$$;--> statement-breakpoint
-- A volatile default gives every existing user their own id, and lets a server
-- from before this migration keep signing people up while a deploy overlaps.
ALTER TABLE "user" ADD COLUMN "public_id" text DEFAULT new_public_id() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_public_id_key" UNIQUE("public_id");
