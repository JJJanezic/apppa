---
name: clean-dev
description: Remove leftover test data from the Dev database only (test users, test tenants, orphan files, orphan audit log rows) and vacuum the audit log. Run after every /deploy, or whenever tests slow down or the RLS test „Person ohne Mitgliedschaft“ fails.
argument-hint: "(no arguments)"
user-invocable: true
---

# Dev Cleanup

## Role
You remove test residue from **„apppa-dev“ only**. Automated tests (Vitest integration, Playwright) create users, tenants, files and audit log rows in Dev. Aborted runs leave users and tenants behind, and deleting a tenant leaves its audit log rows. The residue slows Dev down (statement timeout in the RLS test) and clutters the operator area.

Answer in German, like every skill in this project.

## Hard Rules
- **Dev only.** Never run anything of this skill against staging (`iikzjqjjxoznrkkixfqa`) or production (`ahclrqbhfpidxjzbpfgb`). The script checks `.env.local`; every SQL call pins the Dev ref with `--linked --project-ref nizgfmvjplhegoosanmu`. Never drop `--project-ref`.
- **Never while tests are running.** Ask the user to stop running test sessions. The script also skips users and tenants younger than two hours.
- **Count first, delete after approval.** Show the dry-run numbers and ask: "Soll ich diese Testdaten in Dev löschen?" Delete only after a yes.
- **Never print secrets** and never read `.env.local` with shell tools. The script loads it itself.
- **Real data stays.** A tenant counts as test data only if it has no member outside the test addresses (`test-…@example.com`, `test-e2e-…@example.com`) and no invitation to a real address. If the dry run would delete a tenant or user you do not recognise as test data, stop and ask.
- Run SQL calls one at a time, never in parallel (they block each other).

## Workflow

### 1. Dry Run (counts only)
```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/clean-dev.mts
npx supabase db query --linked --project-ref nizgfmvjplhegoosanmu "select count(*) as orphan_audit, (select count(*) from public.audit_log) as audit_total from public.audit_log a where a.tenant_id is not null and not exists (select 1 from public.tenants t where t.id = a.tenant_id)"
```
Report as a short table: test tenants, test users, orphan files per bucket, orphan audit rows, what stays. Ask for approval.

### 2. Delete Users, Tenants and Files
```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/clean-dev.mts --apply
```
Deleting tenants cascades to all their data (bookings, invoices incl. issued ones, guests …). The cascade writes new audit rows; step 3 removes them.

### 3. Orphan Audit Rows
Repeat until `deleted` is 0 (25,000 rows per call):
```bash
npx supabase db query --linked --project-ref nizgfmvjplhegoosanmu -f scripts/clean-dev-audit.sql
```

### 4. Vacuum (own call, after step 3)
```bash
npx supabase db query --linked --project-ref nizgfmvjplhegoosanmu "vacuum (full, analyze) public.audit_log"
```
Without it, queries on the audit log stay slow (dead pages), even with few rows left.

### 5. Check
Run step 1 again. Expected: 0 everywhere except the kept data. Report the before/after numbers to the user.

## Notes
- The daily cleanup crons (unused guest documents, logos, invoice PDFs) do not run in Dev; files of deleted test tenants are handled here.
- If the dry run shows an unexpected tenant (e.g. one the user created by hand without members), leave it and mention it.
- Background: memory note "Dev-Protokoll Testreste" and `docs/runbooks/supabase.md`, section „Testdaten bereinigen (Dev)“.

## Handoff
> "Dev ist bereinigt. Nächstes Feature: `/write-spec` bzw. `/help`, um zu sehen, was als Nächstes ansteht."
