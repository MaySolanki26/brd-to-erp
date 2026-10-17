# Understanding Flow Spec (MVP Stage 1)

## Goal
Authorized users upload BRD documents and context notes per project. The system parses them, extracts requirements, business rules and modules with source links, builds project memory, generates clarification questions, applies user answers, keeps a versioned project summary, and produces an approvable Understanding Report.

## Non-goals
ERP blueprint, prototype, code generation, project chat, OCR, S3 driver.

## 1. Access model
- Organization → Users. Org roles: ORG_ADMIN, MEMBER.
- ProjectMember(userId, projectId, role). Project roles: OWNER, ANALYST, APPROVER, VIEWER.
- Permissions: VIEWER read; APPROVER read + approve reports; ANALYST read, add sources/notes, answer questions, reprocess; OWNER all ANALYST rights + manage members, archive, approve; ORG_ADMIN manages org users and has full access to org projects.
- Every query scoped by organizationId AND membership (or ORG_ADMIN).
- No access → 404. Creator becomes OWNER. Last OWNER cannot be removed or demoted.
- Worker jobs carry orgId + projectId + sourceId and re-verify them.
- Refresh tokens rotate on every use. A rotated token replayed after a 10-second grace window revokes its whole family (theft); inside the window it is treated as a concurrent refresh from another tab and only refused.

## 2. Data model
- ProjectMember (unique userId+projectId); RefreshSession (hashed token, familyId, expiresAt, revokedAt, userAgent, ip).
- Document (versioned file) and ContextNote (title, body ≤ 20k chars); status UPLOADED | PROCESSING | PROCESSED | FAILED + failureReason.
- Chunk: belongs to DocumentVersion or ContextNote; stable key (sourceId + order + content hash); heading path.
- Requirement, BusinessRule, Module: status CONFIRMED | ASSUMED | OPEN | REJECTED | NEEDS_REVALIDATION | NEEDS_REVIEW; sourceChunkId required; moduleId optional; createdBy AI | userId.
- Question: moduleId?, text, reason GAP | AMBIGUITY | CONFLICT | MISSING_RULE, priority CRITICAL | HIGH | NORMAL, status OPEN | ANSWERED | DISMISSED, linked item ids, version.
- Answer + Decision (who, when, answer, affected items, before/after).
- ProjectSu versioned JSON, generatedAt, basedOn source versions.
- LlmUsage: projectId, promptName, model, input/output/cached tokens, cost, durationMs, status.

## 3. Pipeline (pg-boss)
- process-source: parse (pdf/docx/xlsx; notes skip) → chunk by headings (size fallback) → extract per chunk.
- extract: LlmProvider + prompts/extraction.md + JSON schema → Zod → retry once → else NEEDS_REVIEW.
- merge: dedupe within project, keep all source links.
- generate-questions: using ProjectSummary + relevant items only.
- apply-answer: update items, create Decision, follow-ups, conflict flag (never silently overwrite CONFIRMED).
- refresh-summary after extraction or answers.
- New document version → previous items NEEDS_REVALIDATION → reprocess.
- All jobs idempotent; reprocess replaces only that source's AI items.

## 4. LLM rules
- Only via LlmProvider (LLM_DRIVER=real | fixture); fixtures in evals/fixtures/<promptName>/<inputHash>.json.
- Prompts in prompts/*.md; output schemas in packages/shared.
- Context = ProjectSummary (cached prefix) + relevant chunks/items only.
- Log usage to LlmUsage, never document content. Per-project monthly token budget; exceeded → jobs paused with clear status.

## 5. API (under /api; project routes check membership)
- Auth: POST /auth/login, /auth/refresh, /auth/logout; GET /auth/me
- Projects: GET/POST /projects; GET/PATCH /projects/:id; POST /projects/:id/archive
- Members: GET/POST /projects/:id/members; PATCH/DELETE /projects/:id/members/:userId
- Documents: POST /projects/:id/documents/upload-url; PUT upload (local driver); POST /projects/:id/documents/:docId/confirm; GET /projects/:id/documents; GET /projects/:id/documents/:docId; POST /projects/:id/documents/:docId/reprocess
- Notes: GET/POST /projects/:id/notes; PATCH /projects/:id/notes/:noteId
- Knowledge: GET /projects/:id/requirements | /rules | /modules (filters, pagination)
- Questions: GET /projects/:id/questions; POST .../questions/:qid/answer; POST .../questions/:qid/dismiss; GET /projects/:id/decisions
- Memory: GET /projects/:id/summary; Status: GET /projects/:id/processing-status
- Reports: see section 8

## 6. UI
Login · Projects list · Create project · Project tabs: Overview, Sources, Requirements, Rules, Modules, Questions, Decisions, Report, Members (OWNER). Source links open chunk text. Actions hidden by role. All screens: loading, empty, error, no-access. Poll while PROCESSING.

## 7. Edge cases (must be tested)
Cross-org/cross-project → 404 · removed member → 404 · last owner rule · duplicate file warning · unsupported/oversized/spoofed file rejected · scanned PDF → FAILED "OCR not supported" · invalid LLM JSON → retry → NEEDS_REVIEW · concurrent answers → 409 · answer conflicts with CONFIRMED → conflict question · new version → NEEDS_REVALIDATION · budget exceeded → paused · job retried → no duplicates.

## 8. Understanding Report and approval
- Generated from ProjectSummary + items: objectives, scope, roles, modules, requirements by status, rules, assumptions, open questions, risks.
- Blocked while CRITICAL questions are OPEN (show list).
- Versions immutable. Status DRAFT → SUBMITTED → APPROVED | REJECTED (reason) | APPROVED_WITH_CONDITIONS (tracked conditions).
- Only APPROVER/OWNER decide; submitter can't approve own report unless sole OWNER.
- Approval stores baseline snapshot (all items + versions), approver, time, comment.
- Item change after approval → report OUTDATED → re-approval needed.
- Print/PDF view.
