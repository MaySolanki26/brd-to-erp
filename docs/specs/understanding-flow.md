# Understanding Flow Spec (MVP Stage 1)

## Goal

Authorized users upload BRD documents and context notes per project. The system parses them, extracts requirements, business rules and modules with source links, builds project memory, generates clarification questions, applies user answers, and keeps a versioned project summary.

## Non-goals (this spec)

Report approval, ERP blueprint, prototype, code generation, project chat, OCR, S3 driver.

## 1. Access model

- Organization → Users. Org roles: ORG_ADMIN, MEMBER.
- ProjectMember(userId, projectId, role). Project roles: OWNER, ANALYST, APPROVER, VIEWER.
- Permissions:
  - VIEWER: read
  - APPROVER: read (+ approve later)
  - ANALYST: read, add sources/notes, answer questions, reprocess
  - OWNER: all ANALYST rights + manage members, archive project
  - ORG_ADMIN: manage org users; full access to all org projects
- Every query scoped by organizationId AND membership (or ORG_ADMIN).
- No access to a project → 404 (never reveal existence).
- Creator of a project becomes OWNER. The last OWNER cannot be removed or demoted.
- Worker jobs carry orgId + projectId + sourceId and re-verify them before work.

## 2. Data model changes

- ProjectMember (unique userId+projectId).
- RefreshSession (hashed token, family id, expiresAt, revokedAt, userAgent, ip).
- Source concept: Document (file, versioned) and ContextNote (title, body ≤ 20k chars). Both have status UPLOADED | PROCESSING | PROCESSED | FAILED + failureReason.
- Chunk: belongs to DocumentVersion or ContextNote; stable key (sourceId + order + content hash); heading path.
- Knowledge items (Requirement, BusinessRule, Module): status CONFIRMED | ASSUMED | OPEN | REJECTED | NEEDS_REVALIDATION; sourceChunkId required; moduleId optional; createdBy (AI | userId).
- Question: projectId, moduleId?, text, reason (GAP | AMBIGUITY | CONFLICT | MISSING_RULE), py (CRITICAL | HIGH | NORMAL), status (OPEN | ANSWERED | DISMISSED), linked item ids, version for optimistic locking.
- Answer + Decision (who, when, answer text, affected item ids, before/after summary).
- ProjectSummary: versioned JSON (modules, key requirements, rules, open questions count, assumptions), generatedAt, basedOn (source versions).
- LlmUsage: per call (projectId, promptName, model, input/output/cached tokens, cost, durationMs, status).

## 3. Pipeline (pg-boss jobs)

- process-source: parse (pdf/docx/xlsx; notes skip parsing) → chunk by headings (fallback size-based) → extract per chunk.
- extract: LlmProvider with prompts/extraction.md + JSON schema → Zod validate → retry once on invalid → else mark chunk NEEDS_REVIEW.
- merge: dedupe similar items within the project, keep all source links.
- generate-questions: from gaps/ambiguities/conflicts/missing rules, using ProjectSummary + relevant items only.
- apply-answer: update linked items, create Decision, create follow-up questions if needed, flag conflicts (never silently overwrite CONFIRMED items).
- refresh-summary: regenerate ProjectSummary after extraction or answers.
- New document version: previous version's items → NEEDS_REVALIDATION, then reprocess.
- All jobs idempotent; reprocessing a source replaces only its own AI-created items.

## 4. LLM rules

- Only through LlmProvider (drivers: real | fixture via LLM_DRIVER). Fixtures in evals/fixtures keyed by promptName + input hash.
- Prompts versioned in prompts/*.md; output schemas in packages/shared.
- Context sent = ProjectSummary (cached prefix) + relevant chunks/items only. Never full documents.
- Log usage to LlmUsage. Never log document content.
- Per-project monthly token budget from env; exceed → jobs pause with clear status.

## 5. API (all under /api, all project routes check membership)

- Auth: POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/me
- Projects: GET /projects, POST /projects, GET /projects/:id, PATCH /projects/:id, POST /projects/:id/archive
- Members: GET/POST /projects/:id/members, PATCH/DELETE /projects/:id/members/:userId
- Documents: POST /projects/:id/documents/upload-url, PUT (local driver upload URL), POST /projects/:id/documents/:docId/confirm, GET /projects/:id/documents, GET /projects/:id/documents/:docId (versions, chunks), POST /projects/:id/documents/:docId/reprocess
- Notes: GET/POST /projects/:id/notes, PATCH /projects/:id/notes/:noteId
- Knowledge: GET /projects/:id/requirements | /rules | /modules (filters: status, module, source, search; pagination)
- Questions: GET /projects/:id/questions (filters), POST /projects/:id/questions/:qid/answer, POST /projects/:id/questions/:qid/dismiss, GET /projects/:id/decisions
- Memory: GET /projects/:id/summary (latest + version list)
- Status: GET /projects/:id/processing-status

## 6. UI screens

Login · Projects list (only accessible) · Create project · Project detail tabs: Overview (status, counts, summary), Sources (upload, notes, status, versions), Requirements, Rules, Modules, Questions, Decisions, Members (OWNER only). Every item shows its source link → opens chunk. Actions hidden when role lacks permission. Every screen: loading, empty, error, no-access states. Processing status polls while PROCESSING.

## 7. Edge cases (must be tested)

Cross-org and cross-project access → 404 · removed member → 404 on next request · last owner rule · duplicate file (hash) warning · unsupported/oversized/spoofed file rejected · scanned PDF with no text → FAILED "OCR not supported" · LLM invalid JSON → retry → NEEDS_REVIEW · two users answering the same question → second gets 409 · answer conflicting with CONFIRMED item → conflict flag + question · new document version → NEEDS_REVALIDATION · token budget exceeded → paused status · job retried twice → no duplicate items.
