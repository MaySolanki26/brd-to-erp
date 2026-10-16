# ADR 0001: Source ingestion (documents and context notes)

Status: accepted
Scope: `docs/specs/understanding-flow.md`, "Sources" slice (no LLM, extraction or questions yet)

## Context

Analysts upload BRD documents (PDF, DOCX, XLSX) and write context notes. The platform must store them per project, parse them in the background and split them into chunks that later stages (extraction, questions, summary) can cite. Uploaded files are untrusted input, and the data is confidential.

## Decisions

### 1. Upload flow: signed URL plus a signed ticket

`POST /documents/upload-url` validates the file name, MIME type and size, then returns the storage upload URL and an HMAC-signed **ticket** binding organization, project, user, file key, name, MIME type, size and optional document id (valid for one hour). `POST /documents/confirm` verifies the ticket before reading the stored bytes.

- The ticket makes `confirm` stateless (no pending-upload table) and stops a user confirming a file key issued to someone else or for another project.
- The ticket uses a separate HMAC key domain from the storage upload token, so the two can never be swapped.
- `document_versions.fileKey` is unique, so one upload cannot be confirmed twice (replay returns 409 and does not delete the stored file).
- Deviation from the spec: confirm is `POST /documents/confirm` (ticket in the body), not `/documents/:docId/confirm`, because the document id does not exist until confirmation.

### 2. Validate the bytes, not the label

On confirm the server re-reads the stored file and checks: size equals the declared size and is within 25 MB; the leading bytes match the claimed type (`%PDF-`, or a zip containing `word/document.xml` / `xl/workbook.xml`). A mismatch deletes the file and creates nothing. A SHA-256 hash is stored per version; identical content in the same project returns a `duplicateOf` warning but is still accepted.

### 3. Parsing in the worker, with libraries chosen for safety and no native builds

| Type | Library                     | Notes                                                                                |
| ---- | --------------------------- | ------------------------------------------------------------------------------------ |
| PDF  | `pdfjs-dist` (legacy build) | One section per page. A PDF with no extractable text fails with "OCR not supported". |
| DOCX | `mammoth`                   | HTML output converted to markdown-style headings so sections carry a heading path.   |
| XLSX | `exceljs`                   | One section per sheet, with sheet/row/column caps.                                   |

DOCX and XLSX are zip archives. Before parsing, the zip central directory is read (without inflating) and archives that would expand past 200 MB are rejected, so a zip bomb never reaches a parser. Extracted text is capped at 2,000,000 characters.

### 4. Failures: permanent vs transient

Errors that retrying cannot fix (no text, corrupt file, too large, missing stored file) mark the source `FAILED` with a user-safe reason and are **not** retried. Anything else releases the source back to `UPLOADED` and rethrows so pg-boss retries with backoff; after the last attempt it is marked `FAILED`. Users can reprocess failed or finished documents.

### 5. Idempotent, race-safe processing

- Chunks carry a stable key (`sha256(sourceId:index:contentHash)`); a run deletes the source's chunks and re-creates them in one transaction, so a retried or repeated job never duplicates chunks.
- A job claims a document only while its version is still the newest, so a job for a superseded version cannot block the current one.
- A note's chunks are written only if the note is unchanged since it was read (`updatedAt` guard), so an edit during processing is never overwritten by stale chunks.
- The worker re-verifies organization, project, document and version against the database before doing any work; ids in the job payload are not trusted.

### 6. Queueing

The API enqueues after the database transaction commits. If queueing fails, the source is marked `FAILED` ("Could not queue processing") and the user can reprocess. This avoids an outbox table at the cost of a small window where a crash between commit and enqueue leaves a source in `UPLOADED`; reprocessing is not offered for `UPLOADED`, so such a source needs an operator re-queue. Accepted for the MVP; revisit if it occurs in practice. pg-boss 10 requires queues to be created before use, so both the API and the worker call `ensureQueues`.

### 7. Access and exposure

- Every query filters on `organizationId` and `projectId`; non-members receive 404.
- Read needs READ; upload, new version and notes need ADD_SOURCE; reprocess needs REPROCESS.
- The unauthenticated `GET /storage/download/:fileKey` route is removed. Downloads go through `GET /documents/:docId/versions/:versionId/download`, which checks project access, streams with `Content-Disposition: attachment` and records an audit entry.
- Logs carry ids, counts and failure reasons only, never document text.
- The raw upload body limit follows `MAX_UPLOAD_BYTES` (shared constant) instead of 50 MB, and body-parser errors now return 4xx instead of a generic 500.

## Consequences

- The chunk table supports two source kinds through nullable `documentVersionId` / `contextNoteId` with a database CHECK that exactly one is set.
- Later stages can rely on chunks existing per version with stable keys and heading paths.
- OCR, an S3 upload driver and non-text content (images inside documents) remain out of scope.
