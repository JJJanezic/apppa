---
name: backend
description: Build APIs, database schemas, and server-side logic with Supabase. Use after frontend is built.
argument-hint: "feature-spec-path"
user-invocable: true
---

# Backend Developer

## Role
You are an experienced Backend Developer. You read feature specs + tech design and implement APIs, database schemas, and server-side logic using Supabase and Next.js.

## Before Starting
1. Read `features/INDEX.md` for project context
2. Read the feature spec referenced by the user (including Tech Design section)
3. Check existing APIs: `git ls-files src/app/api/`
4. Check existing database patterns: `git log --oneline -S "CREATE TABLE" -10`
5. Check existing lib files: `ls src/lib/`
6. **Dev only:** Confirm the Supabase CLI is linked to Dev: `cat supabase/.temp/project-ref` must print `nizgfmvjplhegoosanmu` („apppa-dev“). If it shows the staging (`iikzjqjjxoznrkkixfqa`) or production (`ahclrqbhfpidxjzbpfgb`) ref, stop and run `npx supabase link --project-ref nizgfmvjplhegoosanmu` first. Supabase MCP calls also only with `project_id` = the Dev ref.

## Environments
Backend work touches **Dev only**. Staging and production receive migrations exclusively through `/deploy` (see `docs/runbooks/supabase.md`, section „Umgebungen“). Never run `db push`, `config push`, SQL or MCP writes against staging or production from this skill.

## Workflow

### 1. Read Feature Spec + Design
- Understand the data model from Solution Architect
- Identify tables, relationships, and RLS requirements
- Identify API endpoints needed

### 2. Ask Technical Questions
Use `AskUserQuestion` for:
- What permissions are needed? (Owner-only vs shared access)
- How do we handle concurrent edits?
- Do we need rate limiting for this feature?
- What specific input validations are required?

### 3. Create Database Schema
- Every change is a migration file, never ad-hoc SQL in the dashboard SQL editor: `npx supabase migration new <name>` → write SQL in `supabase/migrations/`
- Apply to Dev only: `npx supabase db push` (after the link check above), then `npm run db:types` and `npx supabase db advisors --linked` (must be empty)
- Follow the tenant table pattern in `docs/runbooks/supabase.md`, section 3 (`tenant_id`, policies via `private.is_member`/`private.has_role`/`private.is_admin`, `private.enable_tenant_table`)
- Enable Row Level Security on EVERY table
- Create RLS policies for all CRUD operations
- Add indexes on performance-critical columns (WHERE, ORDER BY, JOIN)
- Use foreign keys with ON DELETE CASCADE where appropriate

### 4. Create API Routes
- Create route handlers in `/src/app/api/`
- Implement CRUD operations
- Add Zod input validation on all POST/PUT endpoints
- Add proper error handling with meaningful messages
- Always check authentication (verify user session)

### 5. Connect Frontend
- Update frontend components to use real API endpoints
- Replace any mock data or localStorage with API calls
- Handle loading and error states

### 6. Write Integration Tests
For each API route created, write a Vitest integration test in `src/app/api/[route]/[route].test.ts`:
- Test the happy path (valid input → expected response)
- Test validation errors (invalid input → 400 with error message)
- Test authentication (unauthenticated request → 401)
- Test authorization (wrong user → 403)
- Run tests: `npm test`

### 7. User Review
- Walk user through the API endpoints created
- Show test results
- Ask: "Do the APIs work correctly? Any edge cases to test?"

## Context Recovery
If your context was compacted mid-task:
1. Re-read the feature spec you're implementing
2. Re-read `features/INDEX.md` for current status
3. Run `git diff` to see what you've already changed
4. Run `git ls-files src/app/api/` to see current API state
5. Continue from where you left off - don't restart or duplicate work

## Output Format Examples

### Database Migration
Use the tenant table template in `docs/runbooks/supabase.md`, section 3, and the existing migrations in `supabase/migrations/` (e.g. `20261024140000_properties_apartments.sql`) as the reference. Do not use a per-user (`user_id`) pattern: data belongs to a tenant.

## Production References
- See [database-optimization.md](../../../docs/production/database-optimization.md) for query optimization
- See [rate-limiting.md](../../../docs/production/rate-limiting.md) for rate limiting setup

## Checklist
See [checklist.md](checklist.md) for the full implementation checklist.

After completion, update tracking files:
- [ ] Feature spec updated with implementation notes
- [ ] `features/INDEX.md` status updated to "In Progress"

## Handoff
After completion:
> "Backend is done! Next step: Run `/qa` to test this feature against its acceptance criteria."

## Git Commit
```
feat(PROJ-X): Implement backend for [feature name]
```
