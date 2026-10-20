# Assistant API

A small HTTP API that lets an external assistant (an agent, a script, a chat tool) work with GeekSign on behalf of one account: list and create documents, add signers and fields, send for signature, hand out signing links, and download the signed PDF.

It lives under `/api/assistant/` and reuses the same service functions as the dashboard routes, so sending, activating, resending and downloading behave exactly as they do in the app.

## Authentication

Every request needs a bearer key:

```
Authorization: Bearer <ASSISTANT_API_KEY>
```

Session cookies are never read on these routes, and the key does not unlock any other route.

| Situation | Response |
| --- | --- |
| `ASSISTANT_API_KEY` not set (or blank) | `503` |
| Wrong, missing or non-bearer credential | `401` `{ "error": "Not authorised." }` |
| Neither `ASSISTANT_USER_ID` nor `ASSISTANT_USER_EMAIL` set | `503` |
| Configured account does not exist | `503` `The assistant's GeekSign account was not found.` |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ASSISTANT_API_KEY` | Shared secret the assistant sends as the bearer token. Compared in constant time. |
| `ASSISTANT_USER_ID` | Id of the GeekSign user the assistant acts as. Wins if both are set. |
| `ASSISTANT_USER_EMAIL` | Email of that user (case-insensitive). Used when no id is set. |
| `NEXT_PUBLIC_APP_URL` | Already used by the app. Dashboard and signing links in responses are built from it. |

## Scoping

The assistant acts as the configured user, with the same reach that user has in the dashboard: documents they own plus documents belonging to teams they are a member of, and templates likewise. Anything outside that returns `404`.

Documents the assistant creates are owned by that user and tagged with their first team, the same as an upload from the dashboard.

## Errors

Errors are JSON: `{ "error": "message" }`.

- `400` the request was not valid (the message names the first problem)
- `401` bad or missing key
- `404` not found, or not reachable by the configured account
- `409` the document is in the wrong state for this action
- `500` `Something went wrong.` (details are in the server log)
- `503` the assistant API is not configured

## Notes before you start

- **Request size.** Vercel limits request bodies to about 4.5 MB. Base64 inflates a file by a third, so PDFs over roughly 3 MB should be sent with `fileUrl` instead of `fileBase64`. PDFs are capped at 20 MB either way.
- **Fields are required.** A PDF document needs at least one field before it can be sent or activated. Pass `fields` together with each recipient when you add them.
- **Coordinates** are PDF points measured from the top-left of the page. `page` starts at 1. Values are stored as whole numbers.
- **Use the custom domain.** `geek-sign.vercel.app` redirects to `sign.houseofgeeks.online`, and HTTP clients drop the `Authorization` header when a redirect changes host, so call `https://sign.houseofgeeks.online` directly.
- **Templates are the easiest path.** A template already has its file, signer slots and fields, so you only supply a title and the signers.

## Endpoints

The examples assume:

```bash
export GEEKSIGN_URL=https://sign.houseofgeeks.online
export GEEKSIGN_ASSISTANT_KEY=your-key
```

### `GET /api/assistant/documents`

List documents, newest first.

Query: `status` (`draft`, `pending`, `completed`, `voided`; any case), `q` (matches the title or any recipient email or name), `limit` (default 25, max 100), `offset`.

```bash
curl -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  "$GEEKSIGN_URL/api/assistant/documents?status=pending&q=acme&limit=10"
```

Response: `{ documents, total, limit, offset }`. Each document has its details, a dashboard `url`, and `recipientSummary: { total, byStatus }`.

### `POST /api/assistant/documents`

Create a draft document from a PDF. Send exactly one of `fileBase64` (raw base64 or a `data:application/pdf;base64,` URL) or `fileUrl` (a public https URL).

Body: `title` (required), `fileName` (optional, defaults to a slug of the title), and `fileBase64` or `fileUrl`.

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Service agreement","fileUrl":"https://example.com/agreement.pdf"}' \
  "$GEEKSIGN_URL/api/assistant/documents"
```

Response `201`: `{ document }`.

`fileUrl` rules: https only, no credentials, and hosts that point inside a network (localhost, `*.local`, `*.internal`, private, loopback and link-local addresses) are refused. Redirects are not followed, the download has a 15 second timeout, and the bytes must start with `%PDF-`.

### `GET /api/assistant/documents/{id}`

One document with its signers.

```bash
curl -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID"
```

Response: `{ document, recipients, fields }`. Each recipient has its status, view and sign times, consent, `fieldCount` and `completedFieldCount`. `fields` is `{ total, completed }`. Signing tokens, IP addresses and user agents are never returned.

### `DELETE /api/assistant/documents/{id}`

Delete a **draft** document. Documents that are pending, completed or voided return `409`.

```bash
curl -X DELETE -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID"
```

Response: `{ deleted: true, documentId }`. The document's recipients, fields and audit log entries are deleted with it. The uploaded PDF is **not** removed from blob storage, the same as deleting from the dashboard.

### `POST /api/assistant/documents/{id}/recipients`

Add signers (and their fields) to a **draft** document. Other statuses return `409`.

Body: one recipient, or `{ "recipients": [...] }` with 1 to 50 entries. Each recipient: `email` (required), `name`, `orderIndex` (default 0), and optional `fields`. Each field: `type` (`signature`, `initials`, `date`, `text`, `checkbox`), `xPosition`, `yPosition`, `page` (default 1), `width` (default 200), `height` (default 60), `required` (default true).

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"recipients":[{"email":"sam@example.com","name":"Sam","fields":[
        {"type":"signature","page":1,"xPosition":72,"yPosition":640},
        {"type":"date","page":1,"xPosition":320,"yPosition":650,"width":120,"height":30}]}]}' \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/recipients"
```

Response `201`: `{ recipients, fieldsCreated }`.

### `PATCH /api/assistant/documents/{id}/recipients/{recipientId}`

Change a signer on a **draft** document. Other statuses return `409`.

Body: any of `name` (up to 200 characters; an empty string or `null` clears it), `email`, `orderIndex` (0 or more). At least one is required, otherwise `400`. Other keys, including `status`, are ignored.

```bash
curl -X PATCH -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"sam.new@example.com","orderIndex":1}' \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/recipients/$RECIPIENT_ID"
```

Response: `{ recipient }`. A recipient that is not on this document returns `404`.

### `DELETE /api/assistant/documents/{id}/recipients/{recipientId}`

Remove a signer, and the fields placed for them, from a **draft** document. Other statuses return `409`.

```bash
curl -X DELETE -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/recipients/$RECIPIENT_ID"
```

Response: `{ deleted: true, recipientId, fieldsDeleted }`.

### `POST /api/assistant/documents/{id}/send`

Send a **draft** document for signature. Signers and the sender get emails, exactly as in the dashboard. Needs at least one recipient and one field. Non-draft documents return `409` (use resend to remind signers).

Body (optional, may be empty): `senderName`, `reminderEnabled`, `reminderIntervalDays` (1 to 30), `reminderRepeatDays` (1 to 30).

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reminderEnabled":true,"reminderIntervalDays":3}' \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/send"
```

Response: `{ document, recipients, emailsSent, emailsFailed, message }`.

### `POST /api/assistant/documents/{id}/activate`

Make the signing links live **without emailing anyone**, and return the links so you can pass them on yourself. Works on draft documents (and returns the links again for pending ones). Needs at least one recipient and one field.

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/activate"
```

Response: `{ message, links: [{ recipientId, name, email, url }] }`. These links are the only place signing tokens are exposed.

### `POST /api/assistant/documents/{id}/resend`

Re-send the invitation email to signers who have not signed or declined. The document must be pending.

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/resend"
```

Response: `{ message, emailsSent, emailsFailed }`.

### `GET /api/assistant/documents/{id}/download`

Download the signed PDF (with the certificate page) of a completed document. Documents that are not completed return `400` `Document is not fully signed yet`. The download is recorded in the audit trail against the configured account's email.

```bash
curl -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" -o signed.pdf \
  "$GEEKSIGN_URL/api/assistant/documents/$DOC_ID/download"
```

### `GET /api/assistant/templates`

List templates the account can use.

```bash
curl -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" "$GEEKSIGN_URL/api/assistant/templates"
```

Response: `{ templates: [{ id, name, description, contentType, recipientCount, recipientRoles, fieldCount, variables, senderFields, createdAt, updatedAt }] }`.

- `recipientCount` is how many signers the template expects, in order.
- `variables` (richtext templates) lists the `{{variables}}` you can fill, with `key`, `label`, `type` and `defaultValue`.
- `senderFields` (PDF templates) lists fields the sender fills in; use their `id` as a key in `senderFieldValues`.

File URLs and content are never returned.

### `POST /api/assistant/templates/{id}/use`

Create a draft document from a template.

Body: `title` and `recipients` (required; 1 to 50 plain email strings or `{ email, name }` objects, in signer order). Optional: `customMessage`, `senderDisplayName`, `variables` (map of variable key to value), `senderFieldValues` (map of sender field id to value).

```bash
curl -X POST -H "Authorization: Bearer $GEEKSIGN_ASSISTANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Acme NDA","recipients":[{"email":"sam@example.com","name":"Sam"}],
       "variables":{"client":"Acme Pty Ltd"}}' \
  "$GEEKSIGN_URL/api/assistant/templates/$TEMPLATE_ID/use"
```

Response `201`: `{ document, recipients }`. The document is a draft with its fields already placed; call `send` or `activate` next.

## Typical flows

1. **From a template:** `GET templates` then `POST templates/{id}/use` then `POST documents/{id}/send`.
2. **From a PDF:** `POST documents` then `POST documents/{id}/recipients` (with `fields`) then `POST documents/{id}/send` or `activate`.
3. **Follow up:** `GET documents?status=pending` then `POST documents/{id}/resend`, and `GET documents/{id}/download` once completed.
4. **Fix a draft:** `GET documents/{id}` to see the signers, then `PATCH documents/{id}/recipients/{recipientId}` to correct a name, email or order (or `DELETE` the signer), or `DELETE documents/{id}` to throw away a draft you do not want. All of these only work while the document is a draft.
