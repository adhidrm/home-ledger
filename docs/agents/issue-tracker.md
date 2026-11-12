# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues on **`adhidrm/home-ledger`** (public repo).

Use the `gh` CLI from inside this repo; it resolves the repo from `git remote origin`. Do not hardcode the slug in commands unless you are outside the checkout.

## Conventions

- One issue per vertical slice. Title is the outcome, not the task ("Pengeluaran: catat transaksi manual", not "add form").
- Body uses `## Context`, `## Acceptance criteria`, `## Out of scope`. Acceptance criteria are checkable statements.
- Specs produced by `/to-spec` are posted as an issue body or, for long ones, a file under `docs/specs/` linked from the issue.
- Labels come from the five canonical triage roles; see `triage-labels.md`. Do not invent new label strings.
- Never close an issue without either a merged PR or a comment stating why it will not be actioned (`wontfix`).

## When a skill says "publish to the issue tracker"

```bash
gh issue create --title "<outcome>" --body-file <tmpfile> --label needs-triage
```

Write the body to a temp file first; long bodies with backticks and quotes break shell escaping.

## When a skill says "fetch the relevant ticket"

```bash
gh issue view <number> --json number,title,body,labels,state,comments
```

The user will normally pass the issue number or URL directly.

## When a skill says "apply a triage label"

```bash
gh issue edit <number> --add-label <role> --remove-label needs-triage
```

## Listing work

```bash
gh issue list --state open --json number,title,labels --limit 50
gh issue list --label ready-for-agent --json number,title
```

## PRs as a request surface

**Off.** `triage` does not treat incoming pull requests as triage candidates. Only issues enter the queue.

Flip this on by writing: "PRs as a request surface: **on**" and adding a section explaining which PRs count (external contributors only, or all).

## Notes for this repo

- Multi-tenant Postgres with RLS: any issue touching `supabase/migrations/` acceptance criteria must include an "anon key returns 0 rows" check (`npm run db:anon-check`).
- Deploy is Cloudflare Workers via OpenNext; an issue affecting runtime behavior must state whether it was verified under `npm run preview`.
- UI copy is Indonesian; issue titles and bodies may be English, but acceptance criteria quoting user-facing text use the Indonesian strings.
