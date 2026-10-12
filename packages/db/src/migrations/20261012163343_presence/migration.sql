CREATE TABLE "presence" (
	"id" text PRIMARY KEY,
	"game_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "presence_gameId_idx" ON "presence" ("game_id");--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_game_id_game_public_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("public_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;