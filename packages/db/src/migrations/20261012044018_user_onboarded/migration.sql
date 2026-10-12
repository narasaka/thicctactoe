ALTER TABLE "user" ADD COLUMN "onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Players who signed in before onboarding existed keep the name they have.
UPDATE "user" SET "onboarded" = true WHERE "is_anonymous" IS NOT TRUE;
