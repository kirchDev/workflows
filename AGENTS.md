# kirchDev/workflows

## What this repo is

The estate's central reusable GitHub Actions workflow **bodies**. Every other repo carries a thin caller stub — `uses: kirchDev/workflows/.github/workflows/_<name>.yml@<sha>` — instead of its own copy. There is no application code; the workflows are the product.

A body runs in **every** calling repo. Before changing one, ask what a repo on another branch topology, another runner or another stack does with the change.

## Commands

| Command                                      | What it does                                                                                                       |
| :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                               | Install deps and wire the husky hooks                                                                              |
| `pnpm check`                                 | The gate: `lint`, `lint:actions`, `format`, `typecheck`, `check:policy`, `check:inputs`, `check:workflows`         |
| `pnpm lint`                                  | `oxlint . --deny-warnings`                                                                                         |
| `pnpm lint:actions`                          | actionlint over every workflow — **needs Docker**                                                                  |
| `pnpm format`                                | `oxfmt --check .` — the check, not the fix                                                                         |
| `pnpm typecheck`                             | `tsc --noEmit` over the meta scripts                                                                               |
| `pnpm check:policy`                          | The two agent policy files ban the same commands                                                                   |
| `pnpm check:inputs`                          | Every `with:` key a local stub passes exists on the body it calls                                                  |
| `pnpm check:workflows`                       | Contract tests, `node --test scripts/workflow-contracts.test.ts`                                                   |
| `pnpm check:fix` / `lint:fix` / `format:fix` | Auto-fix                                                                                                           |
| `pnpm skills:update`                         | Refresh project-scoped skills via skills.sh                                                                        |
| `pnpm taze` / `taze:w`                       | Dependency upgrade check / write                                                                                   |

- CI derives its steps from the `check` script, so adding a task there is enough.
- `lint:actions` silences `SC2016`, `SC2086` and `SC2129`; each is deliberate (single-quoted `node -e`, word splitting in the task loop, inherited style).
- **An unknown caller input fails the run at startup** (`startup_failure`, no input named) and no linter sees it across repos. `check:inputs` catches it for this repo's local stubs only; a caller elsewhere pinned to an older SHA may legitimately differ.
- **No workflow commits back to a branch.** A red check telling you to run `pnpm check:fix` is the contract: auto-commit actions push unsigned commits that `main` and `dev` reject, and a `GITHUB_TOKEN` push triggers no CI. A workflow that must change files opens a pull request with an API-written commit (`_open-regenerated-pr.yml`).

## Toolchain and conventions

- **Node 26** (`.nvmrc`; `engines` allows `>=24`), **pnpm 12** (`packageManager`). `pnpm-workspace.yaml` keeps `minimumReleaseAge: 4320` and `nodeLinker: isolated` — don't loosen them. Leave `pmOnFail` unset; the file says why.
- **oxc, not eslint/prettier**: `.oxlintrc.json` (`unicorn` + `oxc`, minimal rules) and `.oxfmtrc.json`.
- **TypeScript without a build step.** Meta scripts and tool configs are `.ts`, run by Node's type stripping. `tsconfig.json` is `strict` + `erasableSyntaxOnly`: no enums, no parameter properties.
- **Husky**: `pre-commit` runs lint-staged (`oxlint --fix` + `oxfmt` on JS/TS, `oxfmt` on JSON/YAML/MD; `README.md`, `AGENTS.md` and `pnpm-lock.yaml` excluded), `commit-msg` runs commitlint with `@commitlint/config-conventional`. Never `--no-verify` unless asked.
- **Every action is pinned to a full commit SHA**, the version as a trailing comment — GitHub's own actions included, since a tag is mutable whoever owns it (CodeQL `actions/unpinned-tag`).
- **Dependabot** (`.github/dependabot.yml`) targets `dev`: npm weekly, actions monthly, 3-day cooldown, minor/patch grouped per ecosystem, majors separate. The security-update blocks carry no `target-branch` on purpose — the file explains it.
- **CodeQL** (`_codeql.yml`): `actions` + `javascript-typescript` with `security-extended,security-and-quality`; Go through the `languages` input. A draft skips the analysis, so a caller's `pull_request` trigger must list `ready_for_review`. No path filters. It runs on **public repos only** — on a private repo code scanning is licensed per committer, so adding it there is a purchase, not a fix.

## Releases

- release-please (`release-please-config.json`, `.release-please-manifest.json`, `release-please.yml` on `main`) cuts the tags callers pin, so a release here is never cosmetic. Only `feat`/`fix` cut one.
- `release-type: node` bumps a private, never-published `package.json`. `simple` would be defensible too; switching after callers pinned tags is not.
- `_release-please.yml`'s `major-alias` (moving `v<major>`) is **off by default**: only this repo and `coverage-report` have tag-pinning consumers, and for the Terraform providers a non-semver `v1` tag is a hazard in the Registry.

## Branching

`dev` is the integration branch: branch off `dev`, PR into `dev`, promote `dev` → `main`; release-please releases from `main`. `promotion-pr.yml` keeps a rolling draft promotion PR open. **Merge it with a merge commit, never a squash** — a squash leaves only the PR's `chore:` title and release-please cuts no tag.

`ci.yml` and `codeql.yml` list both `main` and `dev` in their pull-request branch filters; without `dev`, PRs into `dev` (Dependabot's included) run no CI.

Bodies detect the estate's second topology, `dev → stage → main`, from whether a `stage` branch exists:

| Push to | `stage` exists? | Promotion PR opened |
| :------ | :-------------- | :------------------ |
| `dev`   | no              | `dev` → `main`      |
| `dev`   | yes             | `dev` → `stage`     |
| `stage` | yes             | `stage` → `main`    |

Creating a `stage` branch moves a repo — this one included — to the three-stage flow without any file changing.

## Visibility and secrets

**The repo must stay public**: a private repo's reusable workflows are callable only from private repos of the same owner, and the callers span the `kirchDev` org and the personal `TitusKirch` account, public repos included. That is also why `LICENSE` stays MIT and CodeQL is free here.

Bodies contain **Bitwarden secret ids** (`df8b447a-…`): vault identifiers, not secrets — only `BWS_ACCESS_TOKEN` opens them. The id is per owner, so a body picks it from `github.repository_owner`; a wrong id silently resolves for nobody. Owners without Bitwarden in CI pass the App PEM as a secret instead ([ADR-0011](docs/99.adr/0011-accept-the-release-app-pem-as-a-secret-where-bitwarden-is-absent.md), [ADR-0012](docs/99.adr/0012-extend-the-pem-secret-to-the-queue-and-regenerated-pr-bodies.md)).

## Bodies and callers

A **body** is `.github/workflows/_<name>.yml`, triggered only by `on: workflow_call`. A **stub** is `.github/workflows/<name>.yml` in the calling repo: it carries the real trigger and only `uses:` the body.

This repo's stubs carry the same filenames and call by local path (`./.github/workflows/_<name>.yml`), so a broken body fails here first. Self-stubs exist for `_ci-check`, `_ci-gradle` (`gradle-smoke.yml` over `fixtures/gradle`), `_codeql`, `_fast-forward-queue`, `_promotion-pr`, `_queue-branch`, `_release-please` and `_skills-update`. Every other body first runs in a calling repo.

Rules at the boundary:

- **Callers pin a commit SHA** with the version as a trailing comment; Dependabot bumps are the review gate ([ADR-0002](docs/99.adr/0002-pin-callers-to-a-commit-sha.md)).
- **Secrets are named, never inherited** — no `secrets: inherit` ([ADR-0003](docs/99.adr/0003-name-every-secret-a-stub-passes.md)).
- **`runs-on` is the `runner` input**, default `ubuntu-latest` — a caller job cannot set `runs-on`, and `app`, `gildstone` and `infrastructure` run every job on Blacksmith. `_ci-laravel.yml` and `_ci-lighthouse.yml` add `heavy-runner`; empty falls back to `runner`.
- **Derive, don't pass** ([ADR-0001](docs/99.adr/0001-derive-a-bodys-configuration-from-the-repo.md)): topology, owner and check list are read from the repo. An input a caller must keep correct is a copy, and copies drift.
- **Caller-supplied values reach `run:` through `env:`**, never interpolated, and **a concurrency group names its body** — `github.workflow` is the caller's name. Details in [Add a body](docs/1.guides/2.add-a-body.md).
- **A body never calls another body or the composite action** — `uses:` takes no expression, so the ref would be hard-coded and diverge from the caller's pin ([ADR-0006](docs/99.adr/0006-keep-the-composite-action-out-of-the-bodies.md)). A caller needing "the body plus one thing" writes its own job around `.github/actions/setup-node-pnpm` instead of adding switches to a body.
- **Job names of bodies without a `Gate`** (queue, release, publish, deploy) are public API: checks report as `<caller-job> / <body-job>`, and a rename breaks required checks estate-wide, silently.
- **Publishing and deploying are one body per target**, composed by the caller and gated on `release-created` ([ADR-0005](docs/99.adr/0005-publish-with-one-body-per-target.md)).

The queue bodies derive the integration branch differently: `_queue-branch.yml` from `github.event.pull_request.base.ref`, `_fast-forward-queue.yml` in a `resolve` job that asks whether `dev` exists.

## CI

- CI is **bodies-as-jobs** the caller composes ([ADR-0004](docs/99.adr/0004-compose-ci-from-bodies-that-are-jobs.md)). Inputs state what a body cannot know (which PHP versions), never which parts to skip.
- CI bodies: `_ci-check`, `_ci-node`, `_ci-laravel`, `_ci-go`, `_ci-rust`, `_ci-gradle`, `_ci-tofu`, `_ci-e2e`, `_ci-lighthouse`, `_coverage`; around them `_verified` / `_record-verified` (tree-hash markers) and `_detect-changes` / `_record-area-fingerprints`.
- `_ci-check.yml` runs one job with one step per task and runs every task before failing ([ADR-0007](docs/99.adr/0007-run-the-gate-as-one-job-with-a-step-per-check.md)). The tasks come from the repo's `check` script: split on `&&`, bare `pnpm <task>` calls expanded recursively, a task with arguments left unexpanded. It hands out **no credential** — a check needing a token stays a job beside the caller.
- `_detect-changes.yml`'s fingerprint job carries **no `permissions:` block** on purpose: a block is validated at startup for every caller.
- `_ci-lighthouse.yml` audits one page per runner; that isolation is the method, not an input.
- Each reporter keeps its own PR comment thread — `coverage-report`, `lighthouse` ([ADR-0008](docs/99.adr/0008-give-each-reporter-its-own-comment-thread.md)).
- A body may precede its second caller when a named one is coming ([ADR-0009](docs/99.adr/0009-write-a-body-before-its-second-caller.md)).
- **Deliberately not bodies:** `gildstone`'s turborepo test bodies, `app`'s `lint` and `test`, `infrastructure`'s `plan`/`apply` (`_ci-tofu.yml` took only `fmt`/`validate`/`tflint`/`trivy`), `sync-projects.yml` (two different files are not two callers) and single-instance workflows such as `app`'s `cv-pdf` and `og-image`. Every other deploy form has a body, so a centralising round cannot drop one silently.

## Required checks are `<caller-job> / Gate`

- Every CI body ends in `Gate`: `needs:` every other job, `if: always()`, fails on `failure` or `cancelled`. Branch protection names only `Gate` checks — never a matrix-named job.
- `skipped` passes. `_ci-check.yml`'s and `_codeql.yml`'s `Gate` are skipped, not green, when their job was skipped on a draft.
- `_ci-check`, `_ci-rust` and `_ci-gradle` accept `gate: false` for a caller that aggregates every job itself ([ADR-0010](docs/99.adr/0010-allow-callers-to-own-the-aggregate-gate.md)).

> [!IMPORTANT]
> **A caller with a required check must not carry `paths-ignore`.** A workflow that does not trigger reports no check, and a required check that never reports blocks the merge forever. Skip inside the body, where `Gate` still reports.

## Migration traps

All 25 repos call the bodies. A migration PR carries each trap's fix in the same change:

| Repo                                                                    | What breaks                                                                                          | Same PR                                                                     |
| :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| every repo                                                              | Check names become `<caller-job> / <body-job>`; the required check becomes `<caller-job> / Gate`     | Set the rule to the `Gate` names and drop `paths-ignore`                    |
| `fast-forward-queue.yml` callers                                        | New `Resolve the integration branch` check                                                           | Add it if the queue checks are required                                     |
| `app`                                                                   | `quality-report` becomes two threads; Lighthouse reports one job per shard plus `summary`            | Drop the combined job, update the rule                                      |
| `app`                                                                   | `deploy.yml` becomes `_deploy-forge.yml`, inputs hyphenated (`environment_url` → `environment-url`)  | Pass `runner` and `php-version: '8.5'`, delete the local `deploy.yml`       |
| `glimpse`                                                               | `_ci-rust.yml` renames `deny`/`build` and runs `fmt`/`clippy`/`test` in one job per platform         | Accepted; Tauri stays a local `tauri` job on `needs: rust`                  |
| `discord-bot`                                                           | The gate runs `typecheck`, which needs the Prisma client and a `DATABASE_URL`                        | Pass both through the `install` input                                       |
| `terraform-provider-laravelforge`                                       | `_ci-go.yml` brings `golangci-lint`                                                                  | Fix its findings                                                            |
| `discord-presence-bot`                                                  | Gains `validate-secrets` and a deploy                                                                | Add the call with its four `PROD_FORGE_*` secrets                           |
| `linear-github-sync`                                                    | Its inline `deploy` becomes `_deploy-wrangler.yml`                                                   | Rewrite the comment forbidding exactly that                                 |
| `TitusKirch/TitusKirch`                                                 | The README render assertion needs a token the gate does not hand out                                 | Keep it as a job beside the `_ci-check.yml` caller                          |

**Fix, not port:** `coverage-report`, `vite-plugin-iconify-bundle` and `TitusKirch/hike-recap` carry a 189-line queue copy without the App-token steps; `forgemap` and `envprism` lack the prerelease-version fix.

**Protection policy, invisible in any run:**

- A required check on an old name blocks the **next** PR, not the one that renamed it (`envprism`).
- Unsigned commits on `dev` can block a promotion into a signed-only `main` (`discord-bot`). That is a human's decision — never an `--admin` merge.

## Permission policy

`.claude/settings.json` has a long `deny` and a short `allow`; `.claude/settings.local.json` is gitignored.

- **`deny` may be generous** and covers stacks the estate may grow into. Block what damages the machine, tears down remote state, or destroys work with no recovery path — `git reflog expire` and `git gc --prune=now` included. Don't block ordinary local development (`rm -rf node_modules`, `docker compose down -v`, deleting a remote branch); those prompt.
- **`allow` stays short**: only what runs many times per session (read-only git, `ls`/`grep`/`rg`, the project's check scripts, a plain `git push`).

> [!IMPORTANT]
> **Never allow a rule that runs arbitrary code** — `php artisan tinker --execute`, `pnpm exec turbo run`, `find . *`, a raw `pnpm dlx`, an MCP tool that executes SQL. One such rule voids the whole `deny` list.

- Prefix rules cannot see a push target or flags before the subcommand; branch protection is the real guard.
- **Codex** carries the same deny list in `.codex/rules/default.rules`; change both together. Check a rule with `codex execpolicy check --pretty --rules .codex/rules/default.rules -- git push --force`.
- `pnpm check:policy` proves parity. A gap the two languages cannot close (string prefix vs. argv tokens, e.g. `Bash(aws iam delete-:*)`) must be declared in the script's `DELIBERATE` list and in the rules file header; undeclared and stale declarations both fail. Neither side normalises flag order or case — parity means the same spellings, not completeness.

## Skills and house style

- `.tituskirch-skills.json` configures the [TitusKirch skills](https://github.com/TitusKirch/skills); reconcile it with `tituskirch-skills-config`. The skills install via `pnpm dlx skills add TitusKirch/skills`, not vendored.
- READMEs follow `/write-readme`: centered hero, prescribed section emojis, GitHub callouts instead of plain blockquotes, footer `[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)`.
- Spell every reference to this repo `kirchDev/workflows`, so one grep finds them all.
- Reference implementations: `../forgemap` for the meta layer, `kirchDev/app` for the workflows (three-stage flow, tree-hash markers).

## Open points

- Whether `skipped` satisfies a required check for a caller's own jobs gated by `_verified.yml` — verify before making the markers estate-wide policy.
- `group: fast-forward-queue` is unqualified; if it is not caller-scoped, two repos draining at once serialise.
- `check:inputs` cannot see callers elsewhere, which pin older SHAs.
- `ci.yml` triggers on `pull_request` only, so `CI / Gate` never reports on `main` and the ruleset picker cannot offer it — the name has to be typed.
- release-please `node` vs. `simple`.
