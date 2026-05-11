import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Jurisdiction } from "@/config/jurisdiction";
import { jurisdictionConfig } from "@/config/jurisdiction";

/**
 * Server-side renderer: Tiptap JSON -> PDF buffer via @react-pdf/renderer.
 *
 * Tiptap node shapes we handle:
 *   - doc                 (root)
 *   - paragraph           (block, content: inline[])
 *   - heading             (block, attrs.level 1-3)
 *   - bulletList / orderedList (block, content: listItem[])
 *   - listItem            (block, content: block[])
 *   - blockquote          (block)
 *   - text                (inline, with optional marks: bold/italic/underline)
 *   - signingField        (inline atom — replaced with filled value or "[Type]")
 *   - variable            (inline atom — should already be substituted; we still
 *                          render the label as a fallback so unfilled vars don't disappear)
 */

interface TiptapMark {
  type: string;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface FieldValueLookup {
  byKey: Record<string, { value: string | null; recipientName: string | null }>;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 64,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.6,
    color: "#0f172a",
  },
  paragraph: { marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 10, marginTop: 6 },
  h2: { fontSize: 17, fontWeight: 700, marginBottom: 8, marginTop: 4 },
  h3: { fontSize: 13, fontWeight: 700, marginBottom: 6, marginTop: 2 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#cbd5e1",
    paddingLeft: 10,
    marginBottom: 8,
    color: "#475569",
  },
  listItem: { flexDirection: "row", marginBottom: 4 },
  listBullet: { width: 14 },
  listContent: { flex: 1 },
  inlineRun: { flexDirection: "row", flexWrap: "wrap" },
  signedField: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  signedFieldCursive: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontStyle: "italic",
    fontFamily: "Times-Italic",
  },
  unsignedField: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 64,
    right: 64,
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  // Audit certificate
  certHeader: { fontSize: 18, fontWeight: 700, marginBottom: 14 },
  certSection: { marginBottom: 14 },
  certLabel: { fontSize: 9, color: "#64748b", marginBottom: 2 },
  certValue: { fontSize: 11, marginBottom: 6 },
  certCompliance: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    fontSize: 9,
    color: "#64748b",
  },
});

function getMark(marks: TiptapMark[] | undefined, type: string) {
  return marks?.some((m) => m.type === type);
}

interface InlineProps {
  node: TiptapNode;
  lookup: FieldValueLookup;
}

function InlineText({ node }: InlineProps) {
  const isBold = getMark(node.marks, "bold");
  const isItalic = getMark(node.marks, "italic");
  const isUnderline = getMark(node.marks, "underline");
  return (
    <Text
      style={{
        fontWeight: isBold ? 700 : 400,
        fontStyle: isItalic ? "italic" : "normal",
        textDecoration: isUnderline ? "underline" : "none",
      }}
    >
      {node.text}
    </Text>
  );
}

function SigningFieldInline({ node, lookup }: InlineProps) {
  const fieldKey = node.attrs?.fieldKey as string | undefined;
  const fieldType = (node.attrs?.fieldType as string | undefined) ?? "text";
  if (!fieldKey) return null;
  const entry = lookup.byKey[fieldKey];
  const value = entry?.value;

  if (!value) {
    return <Text style={styles.unsignedField}>[unsigned {fieldType}]</Text>;
  }

  if (fieldType === "checkbox") {
    return <Text style={styles.signedField}>{value === "checked" ? "[x]" : "[ ]"}</Text>;
  }

  if (fieldType === "signature" || fieldType === "initials") {
    return <Text style={styles.signedFieldCursive}>{value}</Text>;
  }

  return <Text style={styles.signedField}>{value}</Text>;
}

function VariableInline({ node }: InlineProps) {
  const label = (node.attrs?.label as string | undefined) ?? "";
  const key = (node.attrs?.variableKey as string | undefined) ?? "";
  // Unfilled variable — show as bracketed placeholder so the gap is visible
  return <Text style={styles.unsignedField}>[{label || key}]</Text>;
}

function renderInline(node: TiptapNode, lookup: FieldValueLookup, key: string | number): React.ReactNode {
  if (node.type === "text") {
    return <InlineText key={key} node={node} lookup={lookup} />;
  }
  if (node.type === "signingField") {
    return <SigningFieldInline key={key} node={node} lookup={lookup} />;
  }
  if (node.type === "variable") {
    return <VariableInline key={key} node={node} lookup={lookup} />;
  }
  if (node.type === "hardBreak") {
    return <Text key={key}>{"\n"}</Text>;
  }
  return null;
}

function renderInlineChildren(node: TiptapNode, lookup: FieldValueLookup): React.ReactNode[] {
  return (node.content ?? []).map((child, i) => renderInline(child, lookup, i)).filter(Boolean);
}

function renderBlock(node: TiptapNode, lookup: FieldValueLookup, key: string | number): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <Text key={key} style={styles.paragraph}>
          {renderInlineChildren(node, lookup)}
        </Text>
      );
    case "heading": {
      const level = (node.attrs?.level as number | undefined) ?? 1;
      const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      return (
        <Text key={key} style={style}>
          {renderInlineChildren(node, lookup)}
        </Text>
      );
    }
    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      return (
        <View key={key} style={{ marginBottom: 8 }}>
          {(node.content ?? []).map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.listBullet}>{ordered ? `${i + 1}.` : "•"}</Text>
              <View style={styles.listContent}>
                {(item.content ?? []).map((child, j) => renderBlock(child, lookup, j))}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case "blockquote":
      return (
        <View key={key} style={styles.blockquote}>
          {(node.content ?? []).map((child, i) => renderBlock(child, lookup, i))}
        </View>
      );
    case "horizontalRule":
      return (
        <View
          key={key}
          style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 }}
        />
      );
    default:
      // Fallback: render inline content if present
      if (node.content) {
        return (
          <Text key={key} style={styles.paragraph}>
            {renderInlineChildren(node, lookup)}
          </Text>
        );
      }
      return null;
  }
}

interface SignedRecipientInfo {
  name: string | null;
  email: string;
  signedAt: Date | null;
  ipAddress: string | null;
}

export interface RenderRichtextDocumentOptions {
  title: string;
  content: TiptapNode | null | undefined;
  lookup: FieldValueLookup;
  recipients: SignedRecipientInfo[];
  jurisdiction: Jurisdiction;
  documentId: string;
  completedAt: Date | null;
}

export async function renderRichtextDocumentToPdf(
  options: RenderRichtextDocumentOptions
): Promise<Buffer> {
  const { title, content, lookup, recipients, jurisdiction, documentId, completedAt } = options;
  const blocks = content && Array.isArray(content.content) ? content.content : [];

  const auditText = jurisdictionConfig[jurisdiction]?.auditText ?? "";

  const doc = (
    <Document title={title}>
      <Page size="A4" style={styles.page} wrap>
        <Text
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#e2e8f0",
            paddingBottom: 6,
          }}
        >
          {title}
        </Text>
        {blocks.map((b, i) => renderBlock(b, lookup, i))}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${title} • Document ${documentId} • Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Audit certificate */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.certHeader}>Certificate of completion</Text>

        <View style={styles.certSection}>
          <Text style={styles.certLabel}>Document</Text>
          <Text style={styles.certValue}>{title}</Text>
          <Text style={styles.certLabel}>Document ID</Text>
          <Text style={styles.certValue}>{documentId}</Text>
          {completedAt && (
            <>
              <Text style={styles.certLabel}>Completed</Text>
              <Text style={styles.certValue}>{completedAt.toUTCString()}</Text>
            </>
          )}
        </View>

        <View style={styles.certSection}>
          <Text style={styles.certLabel}>Signers</Text>
          {recipients.map((r, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>
                {r.name || r.email}
              </Text>
              <Text style={{ fontSize: 9, color: "#475569" }}>{r.email}</Text>
              {r.signedAt && (
                <Text style={{ fontSize: 9, color: "#475569" }}>
                  Signed: {r.signedAt.toUTCString()}
                </Text>
              )}
              {r.ipAddress && (
                <Text style={{ fontSize: 9, color: "#475569" }}>
                  IP: {r.ipAddress}
                </Text>
              )}
            </View>
          ))}
        </View>

        {auditText && (
          <Text style={styles.certCompliance}>{auditText}</Text>
        )}
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
