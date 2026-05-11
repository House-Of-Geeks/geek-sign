#!/usr/bin/env node
// Relax required defaults across richtext templates & docs.
//
// New rule: only signature fields are required by default. Every other field
// type becomes optional. Applies to:
//   - templates.content (signingField node attrs)
//   - documents.content (signingField node attrs)
//   - document_fields.required (DB column for already-created docs)
//
// Idempotent.

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const sql = neon(dbUrl);

const REQUIRED_TYPES = new Set(["signature"]);

function relax(node) {
  if (!node || typeof node !== "object") return node;
  if (node.type === "signingField" && node.attrs) {
    const ft = node.attrs.fieldType;
    return {
      ...node,
      attrs: { ...node.attrs, required: REQUIRED_TYPES.has(ft) },
    };
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map(relax) };
  }
  return node;
}

async function fixTemplates() {
  const rows = await sql`SELECT id, content FROM templates WHERE content_type='richtext' AND content IS NOT NULL`;
  let touched = 0;
  for (const r of rows) {
    const fixed = relax(r.content);
    if (JSON.stringify(fixed) !== JSON.stringify(r.content)) {
      await sql`UPDATE templates SET content=${JSON.stringify(fixed)}::jsonb WHERE id=${r.id}`;
      console.log(`  templates ${r.id}: relaxed`);
      touched++;
    }
  }
  console.log(`templates: ${touched}/${rows.length} updated`);
}

async function fixDocuments() {
  const rows = await sql`SELECT id, content FROM documents WHERE content_type='richtext' AND content IS NOT NULL`;
  let touched = 0;
  for (const r of rows) {
    const fixed = relax(r.content);
    if (JSON.stringify(fixed) !== JSON.stringify(r.content)) {
      await sql`UPDATE documents SET content=${JSON.stringify(fixed)}::jsonb WHERE id=${r.id}`;
      console.log(`  documents ${r.id}: relaxed`);
      touched++;
    }
  }
  console.log(`documents: ${touched}/${rows.length} updated`);
}

await fixTemplates();
await fixDocuments();

// Now the document_fields rows for richtext docs
const fieldRows = await sql`
  UPDATE document_fields df
  SET required = CASE WHEN df.type = 'signature' THEN true ELSE false END
  FROM documents d
  WHERE df.document_id = d.id
    AND d.content_type = 'richtext'
    AND df.field_key IS NOT NULL
  RETURNING df.id
`;
console.log(`document_fields: ${fieldRows.length} richtext rows updated`);
