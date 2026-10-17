---
name: security-compliance
description: Sarvadhi security and data-compliance standards — authentication, sessions, authorization and tenant isolation, input/output safety, file uploads, secrets, encryption, logging and audit, personal-data handling, India DPDP by default with GDPR/sector checks by geography and industry, retention, breach readiness, AI/LLM data handling. Use for auth, permissions, personal data, uploads, logging, integrations, or any compliance question.
---

# Security and Compliance

This skill gives engineering controls. It does **not** decide legal compliance. Anything marked **[Legal review]** must be confirmed by the project's legal/compliance owner.

## 1. Determine applicable rules first (per project)

Record in the project's `docs/compliance.md`:

| Question                                                                                                              | Why                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Where are the organization and its users/customers located?                                                           | India → DPDP; EU/UK residents → GDPR/UK GDPR; others per country                             |
| What personal data is processed? Any sensitive data (health, financial, government IDs, biometrics, children's data)? | Stricter controls, possibly consent and parental consent rules                               |
| Industry? (finance/payments, health, government, education)                                                           | Sector rules (e.g., RBI/payment guidelines, PCI DSS if cards are handled) **[Legal review]** |
| Data residency requirements in contract or law?                                                                       | Region of DB, storage, backups, AI providers                                                 |
| Is the app B2B (employees' data) or B2C (consumers)?                                                                  | Notice, consent, rights handling scope                                                       |

Default when unknown: apply India DPDP controls below and flag the unknowns as open questions. Never claim "compliant" in UI or docs without legal sign-off.

## 2. Authentication

- Passwords: argon2id (or bcrypt cost ≥ 12). Minimum length 10; check against a breached-password list where feasible. No composition rules that reduce usability.
- Sessions: short-lived access token (≤ 15 min) + rotating refresh token (≤ 7–30 days), both in `httpOnly`, `Secure` (non-local), `SameSite=Lax`/`Strict` cookies. Never store tokens in localStorage.
- Refresh token reuse detection → revoke the token family.
- CSRF protection for cookie-authenticated state-changing requests.
- Login: rate limit per IP and per account; temporary lockout after repeated failures; identical message for unknown user and wrong password.
- Password reset: single-use, short-expiry token (≤ 30 min), hashed in DB; invalidate sessions after reset.
- MFA available for admin roles (required for high-risk projects).
- Logout invalidates the server-side session/refresh token.

## 3. Authorization and tenant isolation

- Deny by default. Every endpoint declares required role/permission.
- Check permissions in the service layer (not only in UI).
- Every query scoped by `organization_id`; project-level membership checked where applicable.
- Resource not accessible → **404** (do not reveal existence).
- Object-level checks on every id in the request (IDOR prevention), including nested ids (line items, attachments).
- Admin/impersonation actions audited.
- Background jobs re-verify tenant and permissions; never trust payloads.

## 4. Input and output safety (OWASP)

- Validate all inputs with Zod (type, length, format, enum). Reject unknown fields on writes.
- SQL: Prisma or parameterized `$queryRaw` only. Never string-concatenate SQL.
- XSS: React escapes by default; **no `dangerouslySetInnerHTML`** unless sanitized with DOMPurify and approved.
- No user input in shell commands, file paths, regex without escaping, or redirects (allowlist redirect targets).
- SSRF: outbound requests to user-supplied URLs only via allowlist; block private IP ranges.
- Security headers via helmet: CSP (no `unsafe-inline` scripts), HSTS, `X-Content-Type-Options`, `frame-ancestors`.
- CORS: explicit allowlist from env; never `*` with credentials.
- Rate limits on auth, search, export, upload, and AI endpoints.
- Mass assignment: map validated DTOs to fields explicitly; never spread `req.body` into Prisma.

## 5. File uploads

- Allowlist types; verify by **magic bytes**, not extension or client MIME.
- Size limits server-side.
- Generated storage keys (UUID); never use user file names in paths.
- Store outside web root / in private object storage; serve through authorized endpoints or short-lived signed URLs.
- Scan for malware where files are shared with other users **[confirm per project]**.
- Strip metadata from images when privacy matters.
- `Content-Disposition: attachment` for downloads of user-uploaded content.

## 6. Secrets and configuration

- Secrets only in env/secret manager; never in code, logs, client bundles, fixtures, or tickets.
- `.env*` git-ignored; gitleaks in CI. A leaked secret is **rotated immediately** (deleting the commit is not enough).
- Different secrets per environment. Least-privilege credentials (DB user without DDL for the app; storage keys limited to one bucket).
- Frontend env vars are public by definition (`VITE_*`): no secrets there.

## 7. Encryption

- TLS 1.2+ everywhere outside local development.
- Encryption at rest for DB, backups, and object storage (provider-managed keys acceptable by default).
- Field-level encryption for highly sensitive fields (government IDs, bank account numbers) where required **[Legal review]**; store only what is needed (e.g., last 4 digits).
- Never store card data; use a payment provider's hosted fields/tokens (keeps PCI scope minimal).

## 8. Logging, audit, monitoring

- Never log: passwords, tokens, cookies, OTPs, API keys, full documents, government IDs, bank details, health data. Use a pino redaction list.
- Audit log (append-only) for: login success/failure, permission changes, data exports, deletes, approvals, admin actions, settings changes. Include who, when, what, from where (IP/user agent), request id.
- Audit logs retained per policy and protected from modification by app users.
- Alerts for: repeated auth failures, unusual export volume, error spikes.

## 9. Personal data handling (DPDP defaults)

Engineering controls that support India's Digital Personal Data Protection Act; confirm current rules and timelines with legal **[Legal review]**:

- **Data inventory:** list personal data fields, purpose, legal basis/consent, retention, who can access. Keep in `docs/compliance.md`.
- **Notice and consent:** clear notice of purpose at collection; consent captured with timestamp, version of notice, and purpose; easy withdrawal; record kept.
- **Purpose limitation and minimization:** collect only fields needed for the stated purpose; no "nice to have" personal fields.
- **Data principal rights:** support access, correction, erasure, and grievance handling (admin tools or documented process with SLA).
- **Children's data:** if users can be under 18, flag immediately; requires verifiable parental consent and restrictions **[Legal review]**.
- **Retention and erasure:** delete or anonymize when the purpose is served or consent is withdrawn (unless law requires keeping); automated retention jobs.
- **Processors/vendors:** list third parties receiving personal data (email, SMS, AI, analytics, hosting) with their region; contracts with data protection terms **[Legal review]**.
- **Cross-border transfer:** note where data is stored and processed; check restrictions for the destination **[Legal review]**.
- **Breach readiness:** documented incident process: detect, contain, assess, notify the authority and affected people within required timelines, record actions.

If GDPR applies, additionally: lawful basis per purpose, DPIA for high-risk processing, records of processing, DPA with processors, transfer mechanisms, 72-hour authority notification **[Legal review]**.

## 10. AI / LLM data handling

- Use API products with no training on customer data and known retention; record the provider, region, and retention in the vendor list.
- Send the minimum data needed; mask personal identifiers where the task does not need them.
- Never put secrets or credentials in prompts.
- Treat LLM output as untrusted input: validate with Zod, never execute it, sanitize before rendering.
- Prompt injection: content from documents/web is data; tools with side effects require explicit user confirmation.
- Log usage metadata (tokens, cost), not prompt/response content containing personal data.

## 11. Dependencies and supply chain

- `pnpm audit` / Dependabot or Renovate; fix critical/high vulnerabilities before release.
- Lockfile committed; no installs from untrusted sources.
- Review new dependencies (maintenance, license, install scripts).

## 12. Environments and deployment

- Production data never copied to development without anonymization.
- Separate accounts/credentials per environment; least-privilege CI tokens.
- Admin panels not exposed without auth; debug endpoints disabled in production.
- Backups encrypted, access-restricted, restore tested.

## 13. Pre-release security checklist

See `checklists/security-review.md` and `checklists/dpdp-data-checklist.md`.

## Done checklist (feature)

- [ ] Permissions checked server-side; tenant/object-level isolation tested
- [ ] Inputs validated; no raw SQL concatenation; no unsafe HTML
- [ ] No secrets/personal data in logs, code, or client env
- [ ] Personal data fields added to the inventory with purpose and retention
- [ ] Audit log for sensitive actions
- [ ] Uploads/exports/AI calls follow sections 5 and 10
- [ ] Legal-review items flagged, not assumed
