#!/usr/bin/env node
// Strip empty text nodes from existing richtext documents/templates.
// Idempotent — only updates rows that have at least one empty text node.
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
if (!dbUrl) {
  console.error("DATABASE_URL_UNPOOLED missing from .env.local");
  process.exit(1);
}
const sql = neon(dbUrl);

function strip(node) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content
        .map(strip)
        .filter(
          (c) => !(c && c.type === "text" && (!c.text || c.text.length === 0))
        ),
    };
  }
  return node;
}

const docs = await sql`SELECT id, content FROM documents WHERE content_type='richtext' AND content IS NOT NULL`;
let docTouched = 0;
for (const d of docs) {
  const cleaned = strip(d.content);
  const before = JSON.stringify(d.content).length;
  const after = JSON.stringify(cleaned).length;
  if (before !== after) {
    await sql`UPDATE documents SET content=${JSON.stringify(cleaned)}::jsonb WHERE id=${d.id}`;
    console.log(`  documents ${d.id}: -${before - after} bytes`);
    docTouched++;
  }
}
console.log(`documents: ${docTouched}/${docs.length} cleaned`);

const tpls = await sql`SELECT id, content FROM templates WHERE content_type='richtext' AND content IS NOT NULL`;
let tplTouched = 0;
for (const t of tpls) {
  const cleaned = strip(t.content);
  const before = JSON.stringify(t.content).length;
  const after = JSON.stringify(cleaned).length;
  if (before !== after) {
    await sql`UPDATE templates SET content=${JSON.stringify(cleaned)}::jsonb WHERE id=${t.id}`;
    console.log(`  templates ${t.id}: -${before - after} bytes`);
    tplTouched++;
  }
}
console.log(`templates: ${tplTouched}/${tpls.length} cleaned`);
