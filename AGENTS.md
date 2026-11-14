# AGENTS.md

Agent instructions for **home-ledger** — pencatat keuangan rumah tangga. Next.js 16 (App Router) + Supabase (Postgres/RLS/Auth) + Cloudflare Workers via OpenNext.

This file is the single source of truth. `CLAUDE.md` only points here.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | dev server, http://localhost:3000 |
| `npm run typecheck` | `tsc --noEmit` — run before claiming done |
| `npm run db:push` | apply `supabase/migrations/` to the linked project |
| `npm run db:test` | SQL tests in `supabase/tests/` (remote) |
| `npm run db:anon-check` | prove anon key with no session returns 0 rows |
| `npm run preview` | build + run the Cloudflare Worker locally |
| `npm run deploy` | build + deploy to Cloudflare |

`db:push` and `db:test` read `SUPABASE_DB_URL` (session pooler URL) from `.env.local`; see `.env.example`.

Local stack: `npx supabase start` (Postgres 54322, API 54321, Studio 54323).

## Non-negotiables

- **RLS on every table.** New table ⇒ policy + `npm run db:anon-check` still passes.
- **AI provider keys decrypted only in Edge Function `ocr`.** Never echo them in a response, never log them.
- **Provider base URL validation stays** (`https://`, public host, reject IP literals/loopback). It is anti-SSRF, not decoration.
- **Google Drive tokens live in the browser only.** Never persist them server-side.
- **UI copy is Indonesian.** Technical docs/comments may be English.

## Structure

```
app/                 App Router routes (dashboard, pengeluaran, tagihan, akun, struk, pengaturan, login, mulai)
components/          primitives: money-input, nav, sheet
lib/                 format, session, receipt-files, zip
middleware.ts        Supabase session refresh + redirect to /login
supabase/migrations/ schema, household RPC, account balances, bill payment, drive export
supabase/functions/ocr/  Edge Function: receipt scan + AI provider storage
supabase/tests/      rls_test, household_test, balance_test
scripts/             anon-check.mjs, zip-check.ts
design/              visual references (not built)
```

## Working style

- Fewest files, shortest working diff. No abstractions with one implementation.
- Delete before adding. If stdlib or the platform already does it, use that.
- Money formatting goes through `lib/format.ts`; never hand-roll it in a component.
- After a change: `npm run typecheck`. If it touched schema or policies: `npm run db:test` and `npm run db:anon-check`.

## Agent skills

### Issue tracker

GitHub Issues on `adhidrm/home-ledger`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Design

Visual refs in `design/`, tokens in `app/globals.css`. See `docs/agents/design.md`.
