# Pre-Release Security Review (OWASP-based)

Mark each: ✅ done · ❌ gap (create task) · N/A with reason.

## Access control

- [ ] Every endpoint has an explicit permission; deny by default
- [ ] Tenant isolation tests (cross-org returns 404)
- [ ] Object-level checks for all ids, including nested resources
- [ ] Admin actions audited

## Authentication and sessions

- [ ] Password hashing argon2id/bcrypt; reset flow single-use + expiry
- [ ] httpOnly + Secure + SameSite cookies; no tokens in localStorage
- [ ] Refresh rotation + reuse detection; logout revokes
- [ ] Login rate limit + lockout; no user enumeration
- [ ] CSRF protection on cookie-based mutations
- [ ] MFA for admin roles (if required)

## Injection and input

- [ ] Zod validation on all inputs; unknown fields rejected
- [ ] No `$queryRawUnsafe` with user input; no string-built SQL
- [ ] No unsanitized `dangerouslySetInnerHTML`
- [ ] No user input in shell/file paths/redirects; SSRF allowlist

## Configuration

- [ ] helmet headers incl. CSP and HSTS
- [ ] CORS allowlist; no wildcard with credentials
- [ ] Debug endpoints/stack traces disabled in production
- [ ] Rate limits on auth, search, upload, export, AI

## Data protection

- [ ] TLS everywhere; encryption at rest confirmed
- [ ] Sensitive fields minimized/encrypted as decided
- [ ] Logs redact secrets and personal data
- [ ] Backups encrypted, restore tested

## Files

- [ ] Magic-byte type check, size limits, generated keys
- [ ] Private storage; signed/authorized downloads

## Secrets and supply chain

- [ ] gitleaks clean; secrets per environment; rotated if ever exposed
- [ ] No critical/high vulnerabilities in dependencies
- [ ] No secrets in frontend env

## Monitoring and incident

- [ ] Error tracking + alerts for auth failures and error spikes
- [ ] Incident/breach process documented with owners and contacts
