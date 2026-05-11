-- Add on-platform rich-text agreement support to documents and templates

ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT 'pdf' NOT NULL,
  ADD COLUMN IF NOT EXISTS "content" jsonb,
  ADD COLUMN IF NOT EXISTS "variables" jsonb,
  ADD COLUMN IF NOT EXISTS "rendered_pdf_url" text;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_name" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT 'pdf' NOT NULL,
  ADD COLUMN IF NOT EXISTS "content" jsonb,
  ADD COLUMN IF NOT EXISTS "variable_schema" jsonb,
  ADD COLUMN IF NOT EXISTS "recipient_roles" jsonb;
--> statement-breakpoint

ALTER TABLE "document_fields"
  ADD COLUMN IF NOT EXISTS "field_key" text;
--> statement-breakpoint
ALTER TABLE "document_fields" ALTER COLUMN "x_position" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "document_fields" ALTER COLUMN "y_position" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "document_fields" ALTER COLUMN "width" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "document_fields" ALTER COLUMN "height" DROP NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "documents_content_type_idx" ON "documents" ("content_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_content_type_idx" ON "templates" ("content_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_fields_field_key_idx" ON "document_fields" ("document_id", "field_key");
