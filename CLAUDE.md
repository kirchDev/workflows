# CLAUDE.md

This file provides guidance to AI coding agents — Claude Code (claude.ai/code) and vendor-neutral tools such as Codex, OpenCode, Cursor, and Copilot — when working with code in this repository.

## Agent instruction files

`CLAUDE.md` and `AGENTS.md` are kept **byte-identical**. `CLAUDE.md` is what Claude Code reads; `AGENTS.md` is what vendor-neutral agent tools read — Codex, OpenCode, Cursor, Copilot, and whatever follows them. Two real files, deliberately not a symlink: not every tool resolves one.

**After editing either file, copy it over the other — don't repeat the edit by hand:**

```bash
cp CLAUDE.md AGENTS.md   # or the reverse, whichever you just edited
```

Retyping a change is exactly how the two drift; one reflowed line or reworded clause is enough. `diff CLAUDE.md AGENTS.md` must print nothing. If it ever does, treat it as a defect and fix it by letting one file win wholesale — never by merging them.

## What this repo is

`workflows` holds the estate's **central reusable GitHub Actions workflow bodies**. Every other repo carries a thin caller stub — `uses: kirchDev/workflows/.github/workflows/<name>.yml@<sha>` — instead of its own copy of the body. Fix once here, every repo picks it up on its next bump. There is no application code; the workflows _are_ the product.

The problem it solves, measured across the 27 repos of both owners: `dev-pr.yml` was byte-identical in 20 of them, `fast-forward-queue.yml` appeared in 26 repos as 8 variants, `queue-branch.yml` in 23 as 6, `codeql.yml` in 18 as 15, and `ci.yml` in 25 as 24 — effectively unique per repo. Copies drift; a call does not.

The variant counts overstate the real divergence, and that is the useful part: `fast-forward-queue.yml`'s 8 variants come down to **three values and one stale copy** — `INTEGRATION_BRANCH` (`main` vs `dev`), the per-owner Bitwarden id, `runs-on` on two repos, and three repos still on a 189-line version missing the App-token steps entirely. The first two are derivable from the repo itself, the third is a runner label, and the fourth is not a variant but a backlog. That is why one body can serve all of them.

Implication when changing a body: it runs in **every** calling repo, not just this one. Ask what a repo that is on a different branch topology, a different runner, or a different stack does with the change — and remember that a body's blast radius is the whole estate, which is why the reference policy below is not a formality.

> [!IMPORTANT]
> This repo was generated from `TitusKirch/scaffold`, so it still ships copies of the very files it exists to centralise. They are the raw material, not the product. As each body moves to a `workflow_call` shape, this repo's own copy becomes a caller of itself — see _Bodies and callers_ below.

## Commands

| Command             | What it does                                               |
| :------------------ | :--------------------------------------------------------- |
| `pnpm install`      | Install deps and wire husky hooks via the `prepare` script |
| `pnpm lint`         | `oxlint . --deny-warnings`                                 |
| `pnpm format`       | `oxfmt --check .` (note: `format` is the check, not fix)   |
| `pnpm typecheck`    | `tsc --noEmit` over the meta scripts                       |
| `pnpm check`        | Runs `lint` + `lint:actions` + `format` + `typecheck` + `check:policy` — the CI gate |
| `pnpm lint:actions` | `actionlint` over every workflow, via Docker                |
| `pnpm check:policy` | Proves the two agent policy files ban the same commands    |
| `pnpm lint:fix`     | Auto-fix lint                                              |
| `pnpm format:fix`   | Auto-fix format                                            |
| `pnpm check:fix`    | Auto-fix lint + format                                     |
| `pnpm skills:update`| Update project-scoped agent skills via the skills.sh CLI   |
| `pnpm taze`         | Interactive dependency upgrade check                       |
| `pnpm taze:w`       | Write upgrade results                                      |

There is no test suite — this is config-only. CI derives its checks from the `check` script, so adding one there is enough.

**`lint:actions` needs Docker**, which is why it is the one check that cannot run without it. `actionlint` ships no npm package, and the workflows are this repo's product — leaving them unchecked while `tsc` guards four meta scripts would be the wrong way round. Three shellcheck rules are silenced via `SHELLCHECK_OPTS` and each is deliberate: `SC2016` (a `node -e` script in single quotes, which must not expand), `SC2086` (word splitting is the point in the task loop), `SC2129` (style, inherited from the originals).

## Architecture / conventions

- **Node 24, pnpm 11.** Pinned via `.nvmrc`, `engines`, and `packageManager`. `pnpm-workspace.yaml` enforces `minimumReleaseAge=4320` (3-day cooldown), isolated node-linker. Don't loosen these without reason. Package-manager enforcement carries no key on purpose: pnpm 11 replaced `packageManagerStrict`/`packageManagerStrictVersion` with `pmOnFail`, whose default `download` already errors on a foreign package manager and fetches the pinned pnpm version — every other value only weakens it, so leave it unset (the rationale sits as a comment in the file).
- **oxc, not eslint/prettier.** Linting via `oxlint`, formatting via `oxfmt`. Configs live in `.oxlintrc.json` / `.oxfmtrc.json`. `oxlint` uses `unicorn` + `oxc` plugins; rules deliberately minimal.
- **TypeScript, no build step.** The meta scripts and the three tool configs are `.ts` — Node 24 strips types natively, so `scripts/check-policy-parity.ts`, `commitlint.config.ts`, `lint-staged.config.ts` and `taze.config.ts` stay directly executable and each tool loads its own `.ts` config unaided. `tsconfig.json` is `noEmit` + `strict` + `erasableSyntaxOnly`, so only strippable syntax (no enums, no parameter properties) can be written; `pnpm typecheck` is the gate. TypeScript covers the meta layer only — there is no application code here, and the workflows themselves are YAML, which `tsc` never sees. Checking them is `actionlint`'s job.
- **Husky hooks** (`.husky/pre-commit`, `.husky/commit-msg`) run `lint-staged` and `commitlint`. `lint-staged.config.ts` excludes `README.md`, `CLAUDE.md`, and `AGENTS.md` (free-form prose) and `pnpm-lock.yaml`. `oxlint --fix --deny-warnings` then `oxfmt` on JS/TS; `oxfmt` only on JSON/YAML/MD.
- **Conventional Commits enforced** via `@commitlint/config-conventional`. Don't `--no-verify` unless explicitly asked.
- **The moving major alias is opt-in, and off by default.** Confirmed in production: `gitignore-sync` cut `v0.1.0` and its `v0` tag moved onto it. release-please cuts exact tags only — `v0.1.0`, never `v0` — so `_release-please.yml` can move `v<major>` onto each release itself, force-pushing that one tag. Moving a tag is normally the thing not to do; an alias is the case where moving it *is* the contract, since it names a major line rather than a release. But **only two repos in the estate have anyone pinning their tags** — this one and `coverage-report` — so the default is `false`: for an npm package the npm version is what resolves, and for the three Terraform providers an extra `v1` is a hazard rather than a no-op, since the Registry reads tags as its version list and `v1` is not valid semver.
- **release-please cuts the tags callers pin.** Files: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml`. Config uses `release-type: node` with `include-v-in-tag: true`, bumping a `"private": true` `package.json` that is never published — the version exists to name the tag. Open point inherited from the build brief: `simple` would be the language-neutral choice and would stop pretending there is a package. Either is defensible; what is not is changing it after callers have pinned tags.
- **Action pins are mixed on purpose, and the split matches the one callers use.** Anything that touches a credential is pinned to a **full commit SHA** with the version as a trailing comment — `bitwarden/sm-action`, `actions/create-github-app-token`, `googleapis/release-please-action`, `pnpm/action-setup`. The rest ride a major tag: `actions/checkout@v7`, `actions/setup-node@v7`, `github/codeql-action/{init,analyze}@v4.37.9`. Dependabot bumps both monthly. Estate-wide these have drifted badly — `actions/checkout` alone appears as `v7`, `v6`, `v3` and a raw SHA across the 27 repos — which is one more thing centralising the bodies fixes by deletion.
- **CodeQL** scans `actions` + `javascript-typescript` with `security-extended,security-and-quality` queries, gated by path filters so non-code changes don't trigger it.
- **Dependabot** groups all minor/patch updates per ecosystem into a single PR (`npm-minor-patch`, `actions-minor-patch`). Majors come as separate PRs.

## AI & skills

- **`.claude/settings.json`** ships a baseline permission policy — see _Permission policy_ below for the rules it follows. `.claude/settings.local.json` (per-machine overrides, typically `enabledMcpjsonServers`) is gitignored.
- **`.tituskirch-skills.json`** configures the [TitusKirch skills](https://github.com/TitusKirch/skills) (commit, PR, issue, release, docs …) per repo. It is the runtime **config**, not an installer. Regenerate/reconcile it with the `tituskirch-skills-config` skill.
- **Installing the skills.** The bundle is installed via the skills.sh CLI (`pnpm dlx skills add TitusKirch/skills`), not vendored into the repo. `pnpm skills:update` refreshes project-scoped skills tracked in `skills-lock.json` (only present once a repo actually installs project skills).

## Permission policy

`.claude/settings.json` is deliberately lopsided: a **long `deny` list and a short `allow` list**. The two sides answer different questions, so they follow opposite rules.

**`deny` may be generous.** A rule for a command the repo doesn't have is a no-op, it never needs maintenance, and it is never reviewed — a too-broad block only surfaces when you actually hit it. So the list covers every stack kirchDev repos might grow into (Laravel, Prisma, Terraform/OpenTofu, AWS), not just this one. `git reflog expire` and `git gc --prune=now` are in there because they destroy the rescue path that survives a `reset --hard`.

The line to draw is **the machine or something remote, not the working copy**. Blocked: anything that wrecks the OS (`dd`, `mkfs`, `chmod -R`, `rm -rf /…`), tears down remote state or resources (`terraform destroy`, `state rm`, `aws ec2 terminate-instances`, `gh repo delete`), or throws away work with no recovery path (force-push, `reset --hard`, `stash drop`). Deliberately *not* blocked, because they are ordinary local development: `rm -rf node_modules`, `docker volume rm`, `docker compose down -v`, `docker system prune`, `php artisan tinker`, deleting a remote branch. Those prompt instead — a command that is sometimes wanted belongs in the middle state, never in `deny`.

**`allow` must stay short.** Its only return is fewer prompts — no safety is gained. Every line has to be read and understood by whoever copies this file, and an unreviewed allow list is more dangerous than none. Keep what occurs many times per session (read-only git, `ls`/`grep`/`rg`, the project's own check scripts) and let everything else ask.

**Three states, not two.** A command in `allow` runs unasked; one in `deny` is impossible and has to be typed by hand; one in **neither list prompts you** — and that middle state is the right default for almost everything. Reserve `deny` for what a mistaken "yes" could not undo. A normal `git push` is not that: it is reversible, visible and the ordinary way work ships, so it sits in `allow`.

> [!IMPORTANT]
> **Never allow a rule that runs arbitrary code.** `php artisan tinker --execute`, `pnpm exec turbo run`, `find . *` (which covers `-delete` and `-exec rm`), a raw `pnpm dlx`, or an MCP tool that executes SQL (`database-query`, `run-query`) each hand back everything the `deny` list took away — a blocked `db:wipe` means nothing next to an allowed `tinker --execute 'DB::statement(...)'`. A deny list is only as strong as the weakest allow rule beside it.

Two things this file cannot do, by design: it cannot tell which branch a `git push` targets (protect release branches with **branch protection**, not permissions), and prefix rules miss flags placed before the subcommand (`docker compose -f x.yml down -v`). Treat it as lowering the odds, not as a guarantee.

Other repos in the estate keep the `deny` list as-is and swap the `pnpm` lines in `allow` for whatever their stack runs.

**Codex gets the same policy** in `.codex/rules/default.rules` — permission config is not portable, so the block list exists twice and **both must be changed together**. Codex uses Starlark `prefix_rule()` calls matching on argument *tokens*, which handles flags and shell chains that the `Bash(…)` prefix patterns miss, and every rule carries its own `match`/`not_match` cases. Check a rule with:

```bash
codex execpolicy check --pretty --rules .codex/rules/default.rules -- git push --force
```

**Parity between the two is machine-checked, not eyeballed.** `pnpm check:policy` (`scripts/check-policy-parity.ts`, part of `pnpm check` and of CI) expands every `prefix_rule` into its concrete argv prefixes — the cartesian product over its alternation lists — and matches the two sets in both directions, so "we changed both files" becomes a number rather than a claim. Two things it encodes are worth knowing before editing either file:

- **The languages differ, so a few gaps cannot be closed.** Claude Code matches a prefix of the command _string_; a `prefix_rule` matches whole argv _tokens_. `Bash(aws iam delete-:*)` therefore bans every delete verb AWS will ever ship, and the Codex side can only enumerate the ones it ships today. Such a difference is legal but must be **declared** — in the `DELIBERATE` list in the script and in the `.codex/rules/default.rules` header — and the check fails both on an undeclared one and on a declaration that has gone stale.
- **Neither language normalises flag order or case.** `rm -rf /` and `rm -fr /` are separate bans; `rm -r -f /` and `redis-cli FlushAll` are neither, and enumerating permutations never ends. The check proves the two files list the **same spellings** — it does not claim the set of spellings is complete. Same caveat as the two below, and for the same reason.

## Branching model

This repo runs a **`dev` integration branch**: branch off `dev`, PR into `dev`, roll `dev` up into `main`, and release-please releases from `main`.

`.github/workflows/promotion-pr.yml` calls this repo's own `_promotion-pr.yml` body to open and update the rolling draft promotion PR. Mark that PR ready and **merge it with a merge commit, never a squash**: squashing collapses the individual `feat:`/`fix:` commits into the PR's own `chore:` title, and release-please then cuts nothing — which here means callers get no tag to bump to.

The estate also has a three-stage variant, `dev → stage → main`, used by repos that deploy into a staging environment. The `_promotion-pr.yml` body serves both: it asks whether a `stage` branch exists and picks the target accordingly (see the table under _Bodies and callers_). This repo is on the two-stage flow, and creating a `stage` branch here would move it to the three-stage flow without any file changing — which is exactly the property the design is after, and exactly why it is worth stating out loud.

`ci.yml` and `codeql.yml` list both `main` and `dev` in their `on: branches:` filters. Without `dev` in `ci.yml`, PRs into `dev` (Dependabot's included) would run no CI at all.

## Visibility

**This repo is public, and that is load-bearing rather than a preference.** A private repo's reusable workflows are callable only from repos owned by the same account, and only from private ones at that. Half the estate lives under `TitusKirch/*`, a personal account rather than the `kirchDev` org, and several kirchDev repos are public — so a private `workflows` could not be called by either group. Public is what makes the call path work at all.

What follows from being public: `LICENSE` stays MIT with the `[MIT](LICENSE) © …` README footer, `codeql.yml` works (GitHub Advanced Security is free on public repos), and `.github/ISSUE_TEMPLATE/config.yml` may keep its Discord forum links.

> [!IMPORTANT]
> Public means the workflow bodies are world-readable. That is fine — they contain no credentials. What they do contain are **Bitwarden secret ids** (`df8b447a-…`), which are vault identifiers, not secrets: they name an entry that only `BWS_ACCESS_TOKEN` can open, and that token is a GitHub secret which never appears in a file. The id is per-owner, so a body must use the id matching `github.repository_owner` or the lookup silently resolves for nobody.

## House style for READMEs and meta files

`/write-readme` skill encodes the canonical structure. Key rules: hero block wrapped in `<div align="center">`, prescribed section emojis (✨ Features, 🚀 Setup, 🤝 Contributing, 🛣️ Versioning, 📄 License), license footer always reads `[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)`. Use GitHub callouts (`> [!TIP]`, `> [!IMPORTANT]`), never plain blockquotes.

## Bodies and callers

A **body** lives in `.github/workflows/_<name>.yml` here and is triggered only by `on: workflow_call`. A **caller stub** lives in every repo — this one included — as `.github/workflows/<name>.yml`, carries the real trigger (`on: push`, `on: workflow_dispatch`), and does nothing but `uses:` the body.

The `_` prefix is the estate convention (`gildstone` already uses it for `_test-node.yml` and friends). It marks a file that never runs on its own, keeps the bodies together in the Actions sidebar, and — the actual reason — lets this repo's own stub carry the same filename as everybody else's.

```yaml
# any repo — .github/workflows/promotion-pr.yml, complete
name: Dev PR
on:
  push:
    branches: [dev, stage]
jobs:
  promotion-pr:
    uses: kirchDev/workflows/.github/workflows/_promotion-pr.yml@<sha> # v0.1.0
```

Four rules govern the boundary, and each one was decided rather than defaulted:

- **Callers pin a commit SHA**, with the version as a trailing comment — exactly how this repo already pins `actions/checkout` and `bitwarden/sm-action`. Moving tags (`@v1`) are published and supported, but a SHA is what the stubs use. Bumps arrive as Dependabot PRs, which is the review gate: write access here would otherwise be unreviewed write access everywhere a body mints a token.
- **Secrets are named, never inherited.** A stub passes exactly what its body needs (`BWS_ACCESS_TOKEN: ${{ secrets.BWS_ACCESS_TOKEN }}`), so a body never sees a secret a repo acquires later. `secrets: inherit` is not used.
- **`runs-on` is hardcoded to `ubuntu-latest` in the body.** A caller job may not set `runs-on` at all — GitHub allows only `name`, `uses`, `with`, `secrets`, `strategy`, `needs`, `if`, `concurrency` and `permissions` there. Making the runner an input is possible and is the conventional escape hatch, but no body needs it yet.
- **Configuration is derived, not passed.** Where a body can read the answer from the repo it runs in — the branch topology, the owner — it does, instead of taking an input the caller has to keep correct. That is the whole point: an input a caller must maintain is a copy, and copies drift.

The estate has **two branch topologies**, and bodies detect which one they are in rather than being told:

| Push to | `stage` exists? | Promotion PR opened |
| :------ | :-------------- | :------------------ |
| `dev`   | no              | `dev` → `main`      |
| `dev`   | yes             | `dev` → `stage`     |
| `stage` | yes             | `stage` → `main`    |

Creating a `stage` branch promotes a repo to the three-stage flow; deleting it demotes the repo back. No flag, no second variant, and every repo keeps the same stub either way.

## This repo's own workflows

A body has no trigger of its own, so this repo needs a stub like anybody else. Its stubs are the **same files other repos carry, under the same names** — `promotion-pr.yml` calls `_promotion-pr.yml` — differing only in that `uses:` takes a local path (`./.github/workflows/_promotion-pr.yml`) instead of `owner/repo@ref`, which means it always runs the body as it exists in that commit. A broken body therefore fails here before it reaches anyone else.

## Migration status

| Body                     | Repos today | Variants | Real divergence                                          | State       |
| :----------------------- | ----------: | -------: | :-------------------------------------------------------- | :---------- |
| `_promotion-pr.yml`      |          20 |        2 | runner label only                                          | ✅ reusable |
| `_queue-branch.yml`      |          23 |        6 | `INTEGRATION_BRANCH`, owner id, runner                     | ✅ reusable |
| `_fast-forward-queue.yml` |         26 |        8 | same three, plus 3 repos on a 189-line copy missing 2 steps | ✅ reusable |
| `_codeql.yml`            |          18 |       15 | action pins, plus the language set (one input)              | ✅ reusable |
| `_release-please.yml`    |          22 |       18 | owner id, plus per-repo publishing (split into its own bodies) | ✅ reusable |
| `_publish-npm.yml`       |           4 |        4 | action pins, one build script, and a fix 2 of 4 never got   | ✅ reusable |
| `_publish-goreleaser.yml` |          3 |        3 | two action pins and a wrong comment                         | ✅ reusable |
| `_ci-check.yml`          |          11 |        ~8 | pins, and a step list that duplicates `package.json`       | ✅ reusable |
| `ci.yml` (families)      |          14 |       16 | genuinely stack-dependent — one body per family            | 📋 next     |

**Variant counts overstate divergence.** Every one of the queue workflows' variants reduces to values the body can derive for itself: `INTEGRATION_BRANCH` from whether `dev` exists, the Bitwarden id from `github.repository_owner`. Neither becomes an input — an input a caller maintains is a copy, and copies drift.

**Three repos are behind, not different.** `coverage-report`, `vite-plugin-iconify-bundle` and `TitusKirch/hike-recap` carry a 189-line `fast-forward-queue.yml` with no `Fetch Queue App PEM` / `Mint Queue App token` / `Open the queue PR as the App` steps. Migrating them is a fix, not a port.

**How the queue bodies derive their two per-repo values.** `_queue-branch.yml` reads the integration branch off `github.event.pull_request.base.ref` — the caller's `branches:` filter already decided which PRs reach it, so the name exists once, in the trigger. `_fast-forward-queue.yml` cannot do that (a queue-branch push, a review and a dispatch all name the head, never the base), so it resolves the branch in a `resolve` job that asks whether `dev` exists, and the other three jobs take it via `needs`. Both read the Bitwarden id from `github.repository_owner`. That new `resolve` job is a new check name — see the job-names warning above.

**A second wrong secret id, in a place the build brief never looked.** The brief flagged three `KIRCHDEV_QUEUE_APP_PEM` references pointing at the wrong owner's vault entry. The same measurement over `release-please.yml` found `KIRCHDEV_RELEASE_APP_PEM` doing it too: TitusKirch's 7 repos agree, kirchDev's split 13 to 2, and the two outliers — this repo and `gitignore-sync` — carry TitusKirch's id. Both bodies now derive the id from `github.repository_owner`, so the class of error is gone rather than the instances fixed. Both outliers have since been corrected — this repo by deriving the id, `gitignore-sync` in its own copy — so no instance is known to remain. A literal that has to be right in 22 places stays a class of error regardless of how many currently are.

**Publishing is one body per target, not one body with switches.** Ten of the 22 repos with `release-please.yml` publish nothing; a combined body would force inputs and secrets on them that they have no use for, and npm's `NPM_TOKEN` and GoReleaser's Bitwarden-held GPG key would both have to be optional, erasing the signal of which one a repo actually needs. The caller composes instead: `release-please` → `publish`, gated on `release-created`. The four deploy repos (`app`, `infrastructure`, `linear-github-sync`, `discord-presence-bot`) keep their own jobs — those genuinely differ.

**A third rollout gap, same shape as the first two.** Two of the four npm repos (`forgemap`, `envprism`) never got the prerelease-version fix: release-please bumps the version on `main` alone, so a `dev` branch published a version semver ranks below the latest release, and `@dev` resolved to something older than `@latest`. The body carries the corrected logic, so migrating those two is a fix rather than a port — exactly like the three repos on the 189-line queue workflow.

**Two publish bodies are not dogfooded here.** This repo ships no npm package and no provider, so `_publish-npm.yml` and `_publish-goreleaser.yml` have no `self`-stub and will first run in a calling repo. Every other body fails here first; these two do not.

**Action pins have drifted independently of the files.** `actions/checkout` appears as `v7` (21×), a raw SHA (6×), `v6` (2×) and `v3`; `github/codeql-action` in seven different refs. Centralising a body collapses its pins to one by construction.

**Coverage is five implementations across eight repos** — `codecov-action`, `vitest-coverage-report-action` (in two versions), `irongut/CodeCoverageSummary`, `sticky-pull-request-comment`, and the estate's own [`kirchDev/coverage-report`](https://github.com/kirchDev/coverage-report). The last one is stack-agnostic by design (Vitest and Pest reports alike), so standardising on it removes what would otherwise be the hardest stack-specific part of a central `ci.yml`. Do that before attempting `ci.yml`, not after.

## CI is bodies-as-jobs, not one pipeline

`ci.yml`'s 24 variants are **four families and three outliers**: 11 repos running a single gate, 5 Node libraries (`lint typecheck test build`), 2 Laravel packages (271/289 lines, near-identical), 3 Terraform providers (`lint go`), plus `app` (705 lines, tree-hash markers and deploy stages), `gildstone` (`detect-changes` and three `workflow_call` test bodies it already wrote itself) and `infrastructure` (OpenTofu).

**One body with `run-test` / `needs-postgres` / `test-command` switches was considered and rejected.** It works, and it turns every stub into a 15-key config file — the drift back, one level up. It also leaves the three outliers as special cases anyway, and they carry the most logic. So a CI body is a **job** the caller composes into its own pipeline, and inputs say what a body *cannot know* (which PHP versions), never which parts to skip.

`_ci-check.yml` is the first, and it fans the gate out over a matrix — **one job per check**, not one job running them all. Collapsing them would cost three things that matter: the run overview stops saying which check failed, `lint` and `test` stop running in parallel, and a single aspect can no longer be a required check on its own.

The task list is derived from the repo's own `package.json` rather than passed in: `resolve` splits the gate script on `&&`, keeps each bare `pnpm <task>` call, and expands recursively, since a gate may chain another aggregate (`skills` runs `verify` → `check` → `lint && format`). That is what carries the repo-specific checks — `validate`, `check:policy`, `skills:check` — along without listing them here; a fixed candidate list would have dropped exactly those. A task taking arguments is left unexpanded, because running it standalone would change what it does.

All of it is built: `_verified.yml` / `_record-verified.yml` (the tree-hash markers from `app` — `skip` gates the caller's own jobs, so a repo takes the markers without handing over its pipeline), `_detect-changes.yml` (path filters, passed in because they describe a layout only the repo knows), `_ci-node.yml`, `_ci-laravel.yml`, `_ci-go.yml`, `_ci-tofu.yml` and `_coverage.yml` around `kirchDev/coverage-report`.

**Deliberately NOT bodies, measured rather than assumed:**

- **`render` needs no body at all.** It is `pnpm render` followed by `git diff --exit-code README.md` — a generated file asserting it is current. That is a gate task, so it belongs in the repo's `check` script, where `_ci-check.yml` picks it up as its own step. Same answer as the `.gitignore` drift check.
- **`quality-report` is blocked on a conflict, not on a second caller.** It posts ONE pull-request comment carrying coverage and the Lighthouse summary together, and its own comment explains why: a second reporting job beside it would start a second thread. But `_coverage.yml` posts a sticky comment of its own — so a repo using both gets exactly the two threads `app` avoided. Before this becomes a body, that has to be settled: either `_coverage.yml` writes into a shared marker, or a repo picks one reporter and not the other.
- **The four deploy jobs.** Repo-owned by design — they touch environments, not code.

**Three bodies are deliberate exceptions to "one instance is not a pattern"**, and the exception is earned by a repo that will need them, not by a hunch:

- `_ci-tofu.yml` — one caller today. `infrastructure` holds the estate's SSOT, and the second Tofu repo should not start by copying 350 lines.
- `_ci-e2e.yml` and `_ci-lighthouse.yml` — `app` has Lighthouse and no E2E, `gildstone` has E2E (already written as a local `workflow_call` body, so the work exists in the wrong repo) and no Lighthouse. Same gattung, complementary halves. `oggsbreinig` is a third turborepo of that shape **with no `ci.yml` at all yet**, and `saas-template` exists to produce more. That is a named third caller, not a guess. The Lighthouse body carries `app`'s shard-merge step too, so the second caller does not have to rebuild it.
- `_ci-rust.yml` — `glimpse` is the only Rust repo today, and the body is written anyway because the alternative is worse: the next one would start by copying a three-platform matrix with an apt list in it. Migrating `glimpse` onto it may change its check names, which is acceptable — that happens once, alongside every other repo's migration. Note that `cargo fmt --check` also runs through `glimpse`'s gate script; the duplication is deliberate, since the gate catches it in seconds on one runner and the body catches it on every platform.

The Lighthouse body generalises `app`'s chain at exactly the two points that were repo-local — how the shard list is produced (`targets` or `targets-command`) and how the app is built. What is NOT generalised is the sharding itself: one runner per page, because two Chrome instances on one worker contend for CPU and that contention lands in the numbers being measured. The isolation is the method, so it stays fixed rather than becoming an input.

## Extending a body that almost fits

A reusable workflow is taken whole: a caller cannot replace one step or insert another. The answer is not switches in the body but a **second surface** — the setup that every Node body opens with also ships as `.github/actions/setup-node-pnpm`, a composite action running inside the caller's own job. A repo needing "the body plus one thing" writes its own job around the action rather than forking.

> [!IMPORTANT]
> The bodies here do **not** call that action, and that is deliberate. A reusable workflow resolves `./…` against the **caller's** workspace, not its own repository, so a body must name `kirchDev/workflows/…@<ref>` in full — and `uses:` accepts no expression, so the ref would be hard-coded. A caller pinning a body to one SHA would then run an action from a different commit, silently. The four setup lines stay duplicated across the bodies; four lines are cheaper than a pin that lies.

## Open points

Carried over from the build brief; none of these is settled.

- **`actionlint` is not wired up.** CodeQL analyses application code this repo does not have; `actionlint` checks workflows, which are the product. It runs clean today (`docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint`), so adding it to `pnpm check` and CI costs nothing but the decision.
- **Does `skipped` satisfy a required check?** The tree-hash marker design leans on it. Verify deliberately before it becomes estate-wide policy.
- **Concurrency group scope.** `group: fast-forward-queue` is unqualified. It should evaluate in the caller's scope; if it does not, two repos draining at once serialise against each other for nothing. Cheap to verify, expensive to discover.
- **Job names are the branch-protection interface.** Centralising renames every check to `<caller-job> / <body-job>` exactly once. That migration is coordinated, not discovered.
- **release-please `node` vs `simple`.** See the release-please bullet above.

## When editing this repo

- Every file referencing `kirchDev/workflows` names this repo. Keep the references consistent so a single `grep -rn "kirchDev/workflows"` catches them all.
- `forgemap` (sibling repo at `../forgemap`) is the de-facto reference implementation of the meta-layer conventions. When unsure about a config choice, check what forgemap does. For the workflows themselves, the reference is `kirchDev/app`, which runs the three-stage flow and the tree-hash markers in production.
- `package.json` is `"private": true` and `"name": "workflows"` — nothing is published to npm. release-please still runs `release-type: node`, so it bumps that private version alongside the tag. **The tags are the interface every caller pins**, so a release here is never cosmetic.
- Changing a body's job **names** changes the check names every caller reports (`<caller-job> / <body-job>`), which is what branch-protection rules match on. Renaming one breaks required checks estate-wide, once, silently. Treat job names as public API.
