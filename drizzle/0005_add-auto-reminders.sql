ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reminder_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reminder_interval_days" integer DEFAULT 3;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reminder_repeat_days" integer;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "next_reminder_at" timestamp;
