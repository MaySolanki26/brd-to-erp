# PR Checklist (copy into .github/pull_request_template.md)

## What and why

<!-- One paragraph. Link the task/issue. -->

## How it was tested

<!-- Commands run, test cases added, manual steps. Screenshots for UI. -->

## Checklist

- [ ] Follows `code-standards` structure and naming
- [ ] Inputs validated (shared Zod schemas); errors typed
- [ ] Tenant/project scoping and permissions checked; tests added
- [ ] DB change follows `db-standards` (migration reviewed, indexes, rollback note)
- [ ] No secrets or personal data in code, logs, or fixtures
- [ ] UI: all 5 states, uses `packages/ui`, theme tokens only
- [ ] Performance budget respected (`performance-nfr`)
- [ ] No new dependency (or approved: name + reason)
- [ ] lint, typecheck, test, build pass

## Risks / rollback

<!-- What could break, how to roll back. -->
