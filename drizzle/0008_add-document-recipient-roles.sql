-- Add recipient_roles to documents for on-platform one-off agreements.
-- Roles are placeholder labels with provisional emails entered during
-- composition; they are finalised into real recipient rows when the user
-- prepares the document for sending.

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "recipient_roles" jsonb;
