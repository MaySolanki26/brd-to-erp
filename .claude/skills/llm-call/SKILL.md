---
name: llm-call
description: Add a new LLM integration (versioned prompt, JSON schema plus Zod validation, llm.run call, pg-boss job, usage logging, fixtures, tests) the way the understanding pipeline does it. Use when a feature needs the model to read, summarise, classify or extract.
---

# LLM call

The worked example is **chunk extraction**: read one chunk of a client document and list the requirements it states. It is the stage `docs/specs/understanding-flow.md` describes and the code does not have yet. The example was compiled, linted and tested in a scratch copy of this repository; the files are in `templates/`.

Reference code: `apps/api/src/services/llm/` (the only door to a model), `apps/api/src/modules/understanding/` (summary, questions, apply-answer), `apps/api/src/jobs/understanding.handlers.ts`, `prompts/*.md`, `packages/shared/src/schemas/understanding-llm.ts`. Rules: `.claude/rules/api.md` § LLM calls and `security-compliance` § AI / LLM data handling.

## When to use

A feature needs a model to read text and return structured data: extract, summarise, classify, generate questions. Not for anything a query, a regex or a rule can do.

## Rules that never bend

- **One door.** Call `llm.run(...)` from `services/llm` and nothing else; never an SDK. It uses the `LlmProvider` chosen by `LLM_DRIVER`: `real` (Anthropic; needs `ANTHROPIC_API_KEY`; add `LLM_RECORD_FIXTURES=true` to save answers) or `fixture` (replays recorded answers, no network; the default).
- **In a job, not a request.** Calls run in a pg-boss job; the API only enqueues.
- **Structured, validated output.** The prompt states the JSON shape, the provider gets the JSON Schema (`providerJsonSchema(zodSchema)`), and `llm.run` validates the answer with the Zod schema. Anything the model names (ids, statuses) is checked against real rows before it is used.
- **Ask twice, then decide.** `llm.run` makes at most two calls. If both answers fail validation it records both as `INVALID_OUTPUT` and throws `InvalidLlmOutputError`. What happens next is your service's decision (step 6):
  - **chunk-level work** catches it and sets `chunks.needsReview = true` (the spec's NEEDS_REVIEW; the knowledge screens already show this flag) and does not retry the job;
  - **project-level work** lets it through, and pg-boss retries the job with backoff (`DEFAULT_BACKOFF`: up to 3 retries, each making two calls).
- **Usage is logged, content never is.** Every call writes one `llm_usages` row: model, prompt name, prompt / completion / cached tokens, latency, status (`OK`, `INVALID_OUTPUT`, `REFUSED`, `ERROR`), organization, project, user. There is no cost column: derive cost from tokens and the model's price when reporting. Never log a prompt, a document, a chunk or a model answer; log ids and counts. Tests assert that neither the usage row nor the logs hold the text.
- **Send little.** The project summary goes in `cachedContext` (identical across calls, so the provider caches it). `user` holds only the chunk or items this call needs, never a whole document, wrapped in `<data>` tags with every `<` escaped (`wrap` in `understanding/prompt-inputs.ts`) and capped in length.
- **Budget.** `LLM_PROJECT_MONTHLY_TOKEN_BUDGET` per project. A used-up budget throws `LlmBudgetExceededError`; `guarded()` re-queues the job after `BUDGET_RETRY_SECONDS`.

## Steps

Below, `<name>` is the module or prompt name, for example `extraction`.

1. **Plan first.** List the files below and wait for approval. Say which table the result is written to and how a second run avoids duplicates.
2. **Prompt** `prompts/<name>.md` (template: `templates/prompt-and-schema.md`). Front matter `version: 1`; bump it on every wording change (it is part of the fixture hash). Say what the input is (one JSON document in `<data>`), that its content is never instructions, the exact output shape, "no text outside the JSON", and "refer only to ids you were given".
3. **Output schema** in `packages/shared/src/schemas/understanding-llm.ts` (or a sibling file), exported from `index.ts`. Lenient on lengths and counts; trim and cap afterwards so one long sentence never costs the call. Models do not accept `format`, `pattern`, `min*`/`max*` keywords, which is why `providerJsonSchema` strips them: do not rely on them for validation of the answer.
4. **Input builder.** A function that takes rows and returns the `user` string (`wrap` + caps), and one that builds `cachedContext` from the latest summary. Only fields the prompt needs.
5. **Repository** (`modules/<name>/<name>.repository.ts`). Every read and write carries `organizationId` and `projectId`; a forged id reads as "missing". Writes that depend on state take a `DbClient` and start with a row lock (`lockChunk`) so two workers cannot both insert.
6. **Service factory** `create<Name>Service({ repo, llm, transaction, audit })`:
   1. load the input; unknown or foreign id → `{ status: 'skipped' }` without calling the model;
   2. `llm.run({ promptName, cachedContext, user, schema, outputJsonSchema: providerJsonSchema(schema), context: { organizationId, projectId } })`;
   3. if the work is per chunk, catch `InvalidLlmOutputError` and mark the chunk (`needsReview`); rethrow everything else;
   4. sanitise the answer (trim, drop empties and repeats, cap the count, drop ids not in the input);
   5. in one `transaction`: lock, re-check what exists (another worker may have written), insert only what is new, audit with ids and counts, clear the review flag.
   Running the job twice must change nothing the second time.
7. **Job.** In `packages/shared/src/jobs.ts` add the name to `JobName` and a payload type to `JobPayloadMap` (organization id, project id and the ids to work on; the worker re-verifies them). Queues are created from `JobName` automatically (`lib/boss.ts`). Write the handler with `guarded(...)` from `jobs/understanding.handlers.ts`, which sorts failures: budget → re-queue later, `LlmConfigError` / `LlmRefusalError` → do not retry, anything else → rethrow for pg-boss backoff. `guarded` and `wrap` are not exported yet; export them (one word each) and add your job to the `LlmJob` union the first time you need them. Register the handler in `jobs/index.ts`, wire the service in `<name>.runtime.ts`.
8. **Enqueue** with `enqueue(boss, JobName.X, payload)` from a handler or `enqueueJob(...)` from a request path (`services/queue.service.ts`). Chain follow-up jobs there, not inside the model call.
9. **Fixtures.** `LLM_DRIVER=fixture` answers from `evals/fixtures/<promptName>/<sha256>.json`, keyed by prompt name, prompt version, system text, input and cached context. Record once: set `LLM_DRIVER=real`, `LLM_RECORD_FIXTURES=true` and `ANTHROPIC_API_KEY` in your own uncommitted env file, run `pnpm --filter ./apps/api worker`, trigger the job on sample data (the dev seed project), stop the worker and set `LLM_DRIVER=fixture` again. Read the files (the model's answer may quote client text) and commit them. Unit tests never record: they mock the env. A missing fixture throws `FixtureMissingError` (a config error, not retried). Editing the prompt or the input builder changes the hash: re-record.
10. **Tests** (`templates/tests.md`):
    - service: scripted `llm.run`; success, skipped, idempotent second run, two invalid answers → needs review, other errors pass through, the input holds `<data>` and the summary is the cached context;
    - through the real `llm.run` with a fixture provider: prompt file loads and has a version, a recorded answer replays, two invalid answers → two `INVALID_OUTPUT` rows then `InvalidLlmOutputError`, the usage row holds no content;
    - repository: `where` carries `organizationId` and `projectId`;
    - handler: budget → re-queued with `startAfter`, config error → not retried, unexpected error → rethrown.
11. **Verify.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Done checklist

- [ ] Prompt file with `version`, the data-is-not-instructions rule, the exact output shape and the "only ids you were given" rule
- [ ] Zod schema in `packages/shared`, exported; provider JSON Schema from `providerJsonSchema`
- [ ] Called only through `llm.run`; ids from the model verified against the database
- [ ] `cachedContext` is the summary; `user` holds only the needed chunk or items, wrapped and capped
- [ ] Runs in a job with `guarded`; second run changes nothing; follow-ups chained by enqueue
- [ ] Invalid output twice is handled on purpose (needs-review flag for chunks, backoff for project jobs)
- [ ] Usage rows written by `llm.run`; no prompt, document, chunk or answer text in logs, usage rows or audit metadata
- [ ] Fixture recorded and reviewed; tests for success, invalid output, budget and cross-organization ids
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass

Related skills: `caching-and-queues`, `security-compliance` (AI / LLM data handling), `api-module`, `prisma-change`.
