# ADR 0003: Questions, decisions and the project summary

Status: accepted
Scope: `docs/specs/understanding-flow.md` §2 (data model), §3 (answer flow), §5 (API), §6 (screens)

## Context

After extraction, the system asks the client clarification questions, records the answers as decisions, and keeps a versioned summary of what the project knows. Two parts were built separately and meet at a small, explicit contract:

- **This ADR's side:** the schema, the API for reading, answering and dismissing, and the three screens (Questions, Decisions, Overview summary).
- **The understanding jobs** (LLM calls): `generate-questions`, `apply-answer`, `refresh-summary`. They own writing new questions, decisions and summary versions.

## Decisions

### 1. Answering is a hand-off, not an LLM call in the request

`POST /questions/:qid/answer` saves the answer and moves the question to `ANSWERED` in one transaction, then queues `apply-answer` after the commit. The job sets `Answer.appliedAt` and creates the `Decision` (one per answer, `answerId` unique, so retries are safe). If queueing fails the answer is kept and the failure is logged; the request does not fail. The UI shows an answer as "being applied" until `appliedAt` is set.

### 2. Optimistic locking with a precise 409

`Question.version` starts at 1 and goes up on every answer or dismissal. The caller sends the version it read. The write is one `UPDATE ... WHERE status = 'OPEN' AND version = :v`; zero rows means the caller lost, and the service reads who won to build the message ("already answered by *Bob*", "already dismissed", or "changed after you opened it"). This is the spec §7 case "two users answering the same question → second gets 409", and it holds for truly simultaneous requests because the check and the write are the same statement.

### 3. Permissions

Reading needs READ. Answering and dismissing need `ANSWER_QUESTION` (analysts and owners; org admins pass everywhere). Refreshing the summary needs `REPROCESS`. Anything outside the caller's organization or project is a 404.

### 4. Data model choices

- `QuestionLink` points at exactly one item (requirement, rule or module) through nullable foreign keys plus a CHECK. Cascade on delete, because a link is a pure child row.
- `Decision.changes` and `Decision.conflicts` are `jsonb` snapshots: per item `{ kind, id, before, after, reason }` and `{ kind, id, title, explanation }`. They are audit-style before/after records, never filtered or joined, which is the case the database standards allow. Titles are part of the snapshot so the timeline stays accurate if an item is renamed later.
- `ProjectSummary.content` holds ids only (never text copied from items). The API adds the current titles when it reads, and leaves out items that no longer exist.
- `dedupeKey` (unique per project) keeps the pipeline from asking the same question twice. `parentQuestionId` links a follow-up to the question whose answer raised it.
- Dismissing records who, when and why. A CHECK requires a reason and a time on every dismissed question.
- Existing column naming (`organizationId`, plain `TIMESTAMP(3)`) was kept for consistency with the rest of the schema rather than switching to snake_case in one table.

### 5. Reading stored JSON leniently

The jobs write `changes`, `conflicts` and summary `content`. The API validates them with shared Zod schemas when it reads. A decision entry that does not match is dropped and logged (ids and counts only), so one odd entry never hides the timeline. A summary whose content does not match its schema is reported as a clear 500 instead of showing partial data.

### 6. Web: state placement

Question filters live in the address bar (`questions.status`, `questions.reason`, `questions.priority`, validated, with defaults on bad values), so a filtered view can be shared and the "Review critical questions" shortcut is just a link with parameters. Server data stays in React Query with a 30 s stale time and invalidation after every write. Pages are 50 questions, newest data first by priority, with "Load more". Anything a person wrote that a conflict would have lost is held in a panel above the list, so it survives the question leaving the filtered list.

### 7. Privacy and logging

Answers and dismissal reasons are free text and can contain personal data. They are stored in the database only, never written to logs or audit metadata (the audit entry records the action and ids), and rendered as plain text. They should be listed in the project's personal-data inventory with their purpose and retention. Answer text is sent to the LLM by the apply-answer job, so the same provider and region notes as for source documents apply.

## Consequences

- Real answers have no visible effect until the apply-answer job runs; the UI says so.
- A dismissal is permanent from the pipeline's point of view (the same gap is not asked again).
- Near-duplicate questions with different wording are not merged; `dedupeKey` only catches the same gap.
- There is no endpoint to reopen an answered or dismissed question; that needs a product decision.
