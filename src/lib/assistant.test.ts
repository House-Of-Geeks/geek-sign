import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AssistantAddRecipientsSchema,
  AssistantCreateDocumentSchema,
  AssistantFieldSchema,
  AssistantSendSchema,
  AssistantUseTemplateSchema,
  MAX_PDF_BYTES,
  assistantAuthStatus,
  checkRemoteFileUrl,
  cleanQuery,
  decodePdfBase64,
  isPdfBytes,
  normaliseRecipients,
  parseDocumentStatus,
  parsePage,
  presentDocument,
  presentRecipient,
  readAssistantKey,
  readAssistantUserRef,
  signingLink,
  slugify,
  toRecipientEmails,
} from "./assistant";

const TINY_PDF = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n";
const TINY_PDF_B64 = Buffer.from(TINY_PDF).toString("base64");

describe("assistant auth", () => {
  it("accepts only the exact bearer token", () => {
    assert.equal(assistantAuthStatus("Bearer sign-key", "sign-key"), "ok");
    assert.equal(assistantAuthStatus("Bearer  sign-key ", "sign-key"), "ok");
  });
  it("rejects a missing, wrong, or non-bearer credential without saying which", () => {
    assert.equal(assistantAuthStatus(null, "sign-key"), "unauthorized");
    assert.equal(assistantAuthStatus("Bearer wrong", "sign-key"), "unauthorized");
    assert.equal(assistantAuthStatus("Bearer sign-ke", "sign-key"), "unauthorized");
    assert.equal(assistantAuthStatus("Basic sign-key", "sign-key"), "unauthorized");
    assert.equal(assistantAuthStatus("Bearer ", "sign-key"), "unauthorized");
  });
  it("refuses every call when the key is unset, blank, or only whitespace", () => {
    assert.equal(assistantAuthStatus("Bearer sign-key", undefined), "unconfigured");
    assert.equal(assistantAuthStatus("Bearer sign-key", readAssistantKey("")), "unconfigured");
    assert.equal(assistantAuthStatus("Bearer sign-key", readAssistantKey("   ")), "unconfigured");
    assert.equal(readAssistantKey("  sign-key\n"), "sign-key");
  });
});

describe("assistant account", () => {
  it("prefers the user id, then a lowercased email, else nothing", () => {
    assert.deepEqual(readAssistantUserRef({ ASSISTANT_USER_ID: " abc " }), { id: "abc" });
    assert.deepEqual(readAssistantUserRef({ ASSISTANT_USER_EMAIL: "  Jos@Example.COM " }), {
      email: "jos@example.com",
    });
    assert.deepEqual(readAssistantUserRef({ ASSISTANT_USER_ID: "abc", ASSISTANT_USER_EMAIL: "a@b.co" }), {
      id: "abc",
    });
    assert.equal(readAssistantUserRef({}), undefined);
    assert.equal(readAssistantUserRef({ ASSISTANT_USER_ID: "  ", ASSISTANT_USER_EMAIL: "" }), undefined);
  });
});

describe("assistant query parsing", () => {
  it("caps search text and pages", () => {
    assert.equal(cleanQuery("  Acme  "), "Acme");
    assert.equal(cleanQuery(null), "");
    assert.equal(cleanQuery("x".repeat(500)).length, 200);
    assert.deepEqual(parsePage(null, null), { limit: 25, offset: 0 });
    assert.deepEqual(parsePage("10", "10"), { limit: 10, offset: 10 });
    assert.deepEqual(parsePage("0", "-3"), { limit: 25, offset: 0 });
    assert.deepEqual(parsePage("9999", "999999"), { limit: 100, offset: 10_000 });
    assert.deepEqual(parsePage("nope", "nope"), { limit: 25, offset: 0 });
  });
  it("accepts a status in any case and names the legal ones when it doesn't know it", () => {
    assert.deepEqual(parseDocumentStatus(null), {});
    assert.deepEqual(parseDocumentStatus(" Pending "), { status: "pending" });
    assert.match(parseDocumentStatus("signed").error ?? "", /draft, pending, completed, voided/);
  });
  it("makes a file name from a title", () => {
    assert.equal(slugify("Service Agreement: Acme Pty Ltd!"), "service-agreement-acme-pty-ltd");
    assert.equal(slugify("***"), "document");
  });
});

describe("assistant schemas", () => {
  it("takes one recipient or a batch and always yields an array", () => {
    const single = normaliseRecipients({ email: "a@example.com", name: "A" });
    assert.equal(single.length, 1);
    assert.equal(single[0].email, "a@example.com");
    const batch = normaliseRecipients({
      recipients: [
        { email: "a@example.com", fields: [{ type: "signature", xPosition: 10, yPosition: 20 }] },
        { email: "b@example.com", orderIndex: 1 },
      ],
    });
    assert.equal(batch.length, 2);
    assert.deepEqual(batch[0].fields?.[0], {
      type: "signature",
      page: 1,
      xPosition: 10,
      yPosition: 20,
      width: 200,
      height: 60,
      required: true,
    });
  });
  it("rejects bad recipients and oversized batches", () => {
    assert.equal(AssistantAddRecipientsSchema.safeParse({ email: "nope" }).success, false);
    assert.equal(AssistantAddRecipientsSchema.safeParse({ recipients: [] }).success, false);
    const many = Array.from({ length: 51 }, (_, i) => ({ email: `p${i}@example.com` }));
    assert.equal(AssistantAddRecipientsSchema.safeParse({ recipients: many }).success, false);
    assert.equal(AssistantAddRecipientsSchema.safeParse(null).success, false);
  });
  it("checks field geometry", () => {
    assert.equal(AssistantFieldSchema.safeParse({ type: "signature", xPosition: -1, yPosition: 0 }).success, false);
    assert.equal(AssistantFieldSchema.safeParse({ type: "signature", page: 0, xPosition: 0, yPosition: 0 }).success, false);
    assert.equal(AssistantFieldSchema.safeParse({ type: "stamp", xPosition: 0, yPosition: 0 }).success, false);
    assert.equal(
      AssistantFieldSchema.safeParse({ type: "text", xPosition: 0, yPosition: 0, width: 0 }).success,
      false,
    );
  });
  it("needs exactly one of fileBase64 or fileUrl to create a document", () => {
    assert.equal(AssistantCreateDocumentSchema.safeParse({ title: "NDA" }).success, false);
    assert.equal(
      AssistantCreateDocumentSchema.safeParse({
        title: "NDA",
        fileBase64: "AAAA",
        fileUrl: "https://example.com/a.pdf",
      }).success,
      false,
    );
    assert.equal(AssistantCreateDocumentSchema.safeParse({ title: "NDA", fileBase64: "AAAA" }).success, true);
    assert.equal(
      AssistantCreateDocumentSchema.safeParse({ title: "NDA", fileUrl: "https://example.com/a.pdf" }).success,
      true,
    );
    assert.equal(AssistantCreateDocumentSchema.safeParse({ title: "", fileBase64: "AAAA" }).success, false);
    assert.equal(AssistantCreateDocumentSchema.safeParse({ title: "NDA", fileUrl: "not a url" }).success, false);
  });
  it("accepts plain emails or {email, name} when using a template", () => {
    const parsed = AssistantUseTemplateSchema.parse({
      title: "Contract",
      recipients: ["a@example.com", { email: "b@example.com", name: "B" }, { email: "c@example.com" }],
      variables: { client: "Acme" },
    });
    assert.deepEqual(toRecipientEmails(parsed.recipients), [
      "a@example.com",
      { email: "b@example.com", name: "B" },
      "c@example.com",
    ]);
    assert.equal(AssistantUseTemplateSchema.safeParse({ title: "Contract", recipients: [] }).success, false);
    assert.equal(AssistantUseTemplateSchema.safeParse({ title: "Contract", recipients: ["nope"] }).success, false);
  });
  it("allows an empty send body and bounds the reminder settings", () => {
    assert.deepEqual(AssistantSendSchema.parse({}), {});
    assert.equal(AssistantSendSchema.safeParse({ reminderEnabled: true, reminderIntervalDays: 0 }).success, false);
    assert.equal(AssistantSendSchema.safeParse({ reminderRepeatDays: 31 }).success, false);
    assert.equal(
      AssistantSendSchema.safeParse({ senderName: "Jos", reminderEnabled: true, reminderIntervalDays: 3 }).success,
      true,
    );
  });
});

describe("assistant pdf intake", () => {
  it("decodes raw base64 and data URLs", () => {
    const raw = decodePdfBase64(TINY_PDF_B64);
    assert.ok(raw instanceof Uint8Array);
    assert.equal(Buffer.from(raw as Uint8Array).toString(), TINY_PDF);
    const url = decodePdfBase64(`data:application/pdf;base64,${TINY_PDF_B64}`);
    assert.ok(url instanceof Uint8Array);
    assert.equal((url as Uint8Array).length, TINY_PDF.length);
  });
  it("rejects anything that is not a PDF", () => {
    assert.equal(decodePdfBase64(Buffer.from("hello world").toString("base64")), "Only PDF files are allowed.");
    assert.equal(typeof decodePdfBase64("!!!not base64!!!"), "string");
    assert.equal(typeof decodePdfBase64("   "), "string");
    assert.equal(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true);
    assert.equal(isPdfBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false);
  });
  it("rejects a PDF over the size cap", () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(MAX_PDF_BYTES)]).toString("base64");
    assert.match(String(decodePdfBase64(big)), /20 MB/);
  });
});

describe("assistant remote file urls", () => {
  it("allows public https urls", () => {
    assert.deepEqual(checkRemoteFileUrl("https://example.com/a.pdf"), { url: "https://example.com/a.pdf" });
    assert.ok("url" in checkRemoteFileUrl("https://8.8.8.8/a.pdf"));
    assert.ok("url" in checkRemoteFileUrl("https://172.32.0.1/a.pdf"));
  });
  it("rejects http, other schemes and junk", () => {
    assert.ok("error" in checkRemoteFileUrl("http://example.com/a.pdf"));
    assert.ok("error" in checkRemoteFileUrl("file:///etc/passwd"));
    assert.ok("error" in checkRemoteFileUrl("ftp://example.com/a.pdf"));
    assert.ok("error" in checkRemoteFileUrl("not a url"));
    assert.ok("error" in checkRemoteFileUrl("https://user:pw@example.com/a.pdf"));
  });
  it("rejects local names and private addresses", () => {
    for (const host of [
      "localhost",
      "app.localhost",
      "printer.local",
      "db.internal",
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "0.0.0.0",
      "2130706433",
      "[::1]",
      "[fc00::1]",
      "[fd12:3456::1]",
      "[fe80::1]",
      "[::ffff:127.0.0.1]",
    ]) {
      assert.ok("error" in checkRemoteFileUrl(`https://${host}/a.pdf`), host);
    }
  });
});

describe("assistant presenters", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("never exposes the signing token, ip address or user agent", () => {
    const presented = presentRecipient({
      id: "r1",
      email: "a@example.com",
      name: "A",
      orderIndex: 0,
      status: "pending",
      viewedAt: null,
      signedAt: null,
      consentGiven: false,
      consentTimestamp: null,
      createdAt: now,
      signingToken: "secret-token",
      ipAddress: "1.2.3.4",
      userAgent: "curl",
    } as Parameters<typeof presentRecipient>[0]);
    assert.equal("signingToken" in presented, false);
    assert.equal("ipAddress" in presented, false);
    assert.equal("userAgent" in presented, false);
    assert.equal(JSON.stringify(presented).includes("secret-token"), false);
    assert.equal(presented.email, "a@example.com");
  });
  it("leaves out content blobs and the public file url, and adds a dashboard link", () => {
    const presented = presentDocument(
      {
        id: "d1",
        title: "NDA",
        status: "draft",
        contentType: "pdf",
        fileName: "nda.pdf",
        fileSize: 10,
        pageCount: null,
        customMessage: null,
        senderDisplayName: null,
        reminderEnabled: false,
        nextReminderAt: null,
        expiresAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        fileUrl: "https://blob.example/unsigned.pdf",
        content: { big: true },
      } as Parameters<typeof presentDocument>[0],
      "https://sign.example",
    );
    assert.equal("fileUrl" in presented, false);
    assert.equal("content" in presented, false);
    assert.equal(presented.url, "https://sign.example/dashboard/documents/d1");
  });
  it("builds a signing link", () => {
    assert.equal(signingLink("https://sign.example", "tok"), "https://sign.example/sign/tok");
  });
});
