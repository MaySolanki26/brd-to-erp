# Personal Data Checklist (India DPDP default)

Engineering checklist only. Confirm legal interpretation and current rules/timelines with the compliance owner. **[Legal review]**

## Applicability

- [ ] Geography of users/customers recorded (India / EU / other)
- [ ] Industry and sector rules identified (or "none known")
- [ ] Children's data possible? (yes → escalate)
- [ ] Data residency requirements recorded

## Data inventory (docs/compliance.md)

| Field               | Category | Purpose          | Basis / consent | Retention              | Access roles   | Stored where      | Shared with  |
| ------------------- | -------- | ---------------- | --------------- | ---------------------- | -------------- | ----------------- | ------------ |
| e.g. customer.phone | contact  | delivery updates | consent v1      | 3 yrs after last order | sales, support | Postgres (Mumbai) | SMS provider |

- [ ] Every personal field in the schema appears in the inventory
- [ ] No field collected without a stated purpose

## Notice and consent

- [ ] Notice shown at collection, in clear language
- [ ] Consent stored with timestamp, notice version, purpose
- [ ] Withdrawal possible and effective (processing stops)

## Rights

- [ ] Access request: export of a person's data
- [ ] Correction: user or admin can fix data
- [ ] Erasure: delete/anonymize flow, respecting legal retention
- [ ] Grievance contact and response process

## Retention

- [ ] Retention period per category
- [ ] Automated purge/anonymization job
- [ ] Backups follow retention (expiry documented)

## Processors and transfers

- [ ] Vendor list with purpose, data shared, region, retention
- [ ] Contracts with data protection terms (legal)
- [ ] Cross-border transfer reviewed (legal)

## Security safeguards

- [ ] Controls from `security-review.md` complete
- [ ] Access to personal data limited by role and audited

## Breach readiness

- [ ] Incident process: detect → contain → assess → notify (authority + affected people) → record
- [ ] Owners and contact list current
- [ ] Notification timelines confirmed with legal
