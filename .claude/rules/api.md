# Rules for apps/api/**

## Layering

- Every endpoint follows: **route → controller → service → repository**.
- Routes define HTTP method, path, and middleware. No logic beyond calling the controller.
- Controllers parse the validated request, call services, and return the response. No direct DB or LLM access.
- Services contain business logic. They call repositories for data and llmService for AI operations.
- Repositories wrap Prisma queries. This is the only layer that imports `prisma`.

## Validation

- Validate every request body, query, and params with a Zod schema before the controller runs.
- Place schemas in `packages/shared/src/schemas/` so the web app can reuse them.
- Use a `validate` middleware that parses and replaces `req.body` / `req.query` with the typed result.

## Error handling

- Throw typed `AppError` subclasses (`NotFoundError`, `ValidationError`, `ForbiddenError`, etc.).
- Never catch and swallow errors silently. Let them propagate to the central error handler.
- The central error handler logs the error with pino and returns a consistent JSON envelope: `{ error: { code, message, requestId } }`.

## Database (Prisma)

- All Prisma calls live in the repository layer only.
- Use `prisma.$transaction()` for any write that touches more than one table.
- Every query must be scoped by `organizationId` — never return cross-tenant data.
- Index all foreign keys and `status` columns in the schema.

## LLM calls

- All LLM calls go through `llmService` — never call an LLM SDK directly.
- Log token usage and latency; never log prompt content or document text.

## Logging

- Use pino with `requestId` on every log line.
- Never log secrets, tokens, API keys, or raw document content.

## Testing

- Every service and repository gets a Vitest file.
- Use dependency injection or mocks for Prisma and external services.
- Name test files `*.test.ts` next to the source file.
