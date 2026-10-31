ALTER TYPE "game_end_reason" ADD VALUE 'abandon';--> statement-breakpoint
CREATE INDEX "game_stalled_idx" ON "game" ("updated_at") WHERE "status" = 'active';