ALTER TABLE "game" ADD COLUMN "rated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Matchmade games were the rated kind; friend games never were.
UPDATE "game" SET "rated" = NOT "private";
