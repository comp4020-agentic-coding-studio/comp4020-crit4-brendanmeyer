# COMP4020 prototype

## What this is
COMP4020 prototype: Astro site (`astro build` → `dist/`), deployed to GitHub Pages.
**The deployed site is graded, not the repo.** Tested live in Chrome at 1920×1080 and 390×844 — both must work.

## Workflow
1. Run the course plugin's **start** skill at the start of each week (pulls spec, carries harness forward).
2. Read the spec (`spec/README.md`) before building.
3. Keep `pnpm dev` running while working.
4. After a round of changes: **stop, show the human a screenshot/diff, wait for review.**
5. Only after review: run `pnpm check`, fix any red, then commit.
6. Commit often — one logical change per commit (fix, config change, cleanup = separate commits). No big end-of-session dumps.
7. Never commit a red state.

## The link-preview card
`public/card.png` (1200x630) is the image a shared link shows; `Layout.astro`
renders it via `title`/`description`/`card` props, set per page from that
page's `<Layout ...>` call (see `src/pages/index.astro`). Replace the card and
pass a real `description` on every page. The card URL resolves against the
page that names it, like any link --- `./card.png` is wrong one directory
down, and nothing in CI checks it, so look at the deployed head when you add
pages.

## Checks — read failures before changing anything; a red check is authoritative
`pnpm check` runs (in order, stops on first failure): **typecheck → build → lint → spec/tests**.
CI runs the same, plus links, evidence, secrets and the deploy — but only once
the repo is public. While it's private (all week, until you ship), CI stays
skipped; `pnpm check` locally is the same roster and the faster loop anyway.
Run separately / CI-only:
- `pnpm dlx linkinator ./dist --silent` (after `pnpm build`) — internal links
- CI also runs: deploy/online check, evidence check, secrets scan

Other checks:
- **spec** (`spec/invariants.test.ts` + weekly `spec/*.test.ts`) — contract failures
- **lint** — stylelint (CSS), oxlint (TS)
- **tests** — anything under Vitest, co-located or in `spec/`
- **evidence** (`pnpm check:evidence`) — `PROCESS.md` citations resolve to real commits, correctly-named `reflections/*.md` exists, `CLAUDE.md` present. Blocks deploy if it fails.
- **secrets** — never commit keys/tokens; pre-commit hook blocks this locally

CI sweep runs 15 min after cutoff — must be green by then (still running = not green). Green = half that week's shipped mark.

## Ground truth
Don't assume what the page looks like — check it (browser / `agent-browser` CLI). Rendered page > mental model.

## Process is graded too
- `PROCESS.md`: short reading-guide citing commits/CLAUDE.md changes/prompts (must resolve via `pnpm check:evidence`). Markers follow those citations — they don't trawl the repo for uncited evidence, so anything not cited doesn't count.
- `reflections/<deliverable-name>.md`: exact filename matching the repo's deliverable, due at cutoff, answers: the breakthrough, and what changed about you as a developer. Not part of deployed site.
- This file (`CLAUDE.md`) is itself read as process evidence — keep it accurate and current.

## Not covered by CI (your job to add)
Accessibility and performance testing (axe-core, Lighthouse, etc.) — not automated here.

## Stack is swappable
Any generator is fine as long as: `pnpm build` → complete site in `dist/`, `package.json` scripts (`check`, `check:evidence`, `build`) still work, output passes `spec/`. Watch for: base path config (repo is served under `/<repo>/`), and commit `pnpm-lock.yaml` (CI uses `--frozen-lockfile`).