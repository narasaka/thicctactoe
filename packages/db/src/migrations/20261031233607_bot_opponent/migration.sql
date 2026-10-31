ALTER TABLE "user" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "search_id" text;--> statement-breakpoint
CREATE INDEX "game_searchId_idx" ON "game" ("search_id") WHERE "search_id" is not null;