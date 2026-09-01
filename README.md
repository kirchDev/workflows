<div align="center">

# 🤖 workflows

**Write a CI workflow once — every repo in the estate runs it**

</div>

---

```yaml
jobs:
  promotion-pr:
    uses: kirchDev/workflows/.github/workflows/_promotion-pr.yml@9f3c1a2 # v0.1.0
```

That's it. A repo carries a stub with the trigger; the workflow body lives here, once.

## 🤔 Why

The canonical workflows used to live in [`scaffold`](https://github.com/TitusKirch/scaffold) and were _copied_ into every new repo, where they immediately began to drift. Measured across the 27 repos of both owners:

| Workflow                 | Repos | Variants | Lines     |
| :----------------------- | ----: | -------: | :-------- |
| `fast-forward-queue.yml` |    26 |        8 | 189 – 397 |
| `ci.yml`                 |    25 |       24 | 42 – 696  |
| `queue-branch.yml`       |    23 |        6 | 175 / 195 |
| `release-please.yml`     |    22 |       18 | 37 – 178  |
| `dev-pr.yml`             |    20 |        2 | 38        |
| `codeql.yml`             |    18 |       15 | 47 – 68   |

`dev-pr.yml` is the outlier that proves the point: two variants differing only in the runner label, 760 lines doing one thing. Everything else has already fragmented — `ci.yml` is effectively unique per repo, and `fast-forward-queue.yml` splits into a 10-repo group, a 6-repo group, and six smaller ones carrying a fix the others never got. A fix meant 20 commits, and nothing told you which repos you had missed.

A call has none of that. The body is fixed in one place, and every repo picks the fix up on its next bump.

## 📦 Available workflows

A **body** is prefixed with `_` and runs only via `workflow_call`. Anything without the prefix is an ordinary workflow — including this repo's own stubs.

| Body                      | What it does                                            | Status      |
| :------------------------ | :------------------------------------------------------ | :---------- |
| `_promotion-pr.yml`       | Opens and updates the rolling draft promotion PR        | ✅ reusable |
| `_queue-branch.yml`       | Cuts the queue branch on the first worker PR            | ✅ reusable |
| `_fast-forward-queue.yml` | Lands the queue onto the integration branch             | ✅ reusable |
| `_codeql.yml`             | CodeQL analysis                                         | ✅ reusable |
| `_release-please.yml`     | Release PRs and tags                                    | ✅ reusable |
| `_publish-npm.yml`        | npm publish — stable from the tag, prerelease from a branch | ✅ reusable |
| `_publish-goreleaser.yml` | Signed Terraform provider artifacts                     | ✅ reusable |
| `_ci-check.yml`           | The gate 11 repos run, derived from `package.json`       | ✅ reusable |
| `_verified.yml`           | Has this tree already passed? — outputs `skip`           | ✅ reusable |
| `_record-verified.yml`    | Marks a tree verified once the caller's jobs are green   | ✅ reusable |
| `_detect-changes.yml`     | Which parts a PR touched — outputs `changes`             | ✅ reusable |
| `_ci-node.yml`            | typecheck, test, build for Node libraries                | ✅ reusable |
| `_ci-laravel.yml`         | Pest across PHP × Laravel, PostgreSQL, PCOV, Pint        | ✅ reusable |
| `_ci-go.yml`              | gofmt, vet, golangci-lint, build, unit + acceptance      | ✅ reusable |
| `_ci-tofu.yml`            | fmt, validate for OpenTofu                               | ✅ reusable |
| `_ci-e2e.yml`             | Playwright against a real backend, with browser cache    | ✅ reusable |
| `_ci-lighthouse.yml`      | Sharded Lighthouse audit, one runner per page            | ✅ reusable |
| `_coverage.yml`           | One sticky comment via `kirchDev/coverage-report`        | ✅ reusable |

`ci.yml` is the one workflow that does not become a single body. Its 24 variants are four families — 11 repos running one gate, 5 Node libraries, 2 Laravel packages, 3 Terraform providers — plus three repos with pipelines of their own. Every family now has its body, and the three outliers compose from the pieces rather than hand over their pipeline.

Two bodies were written **ahead of their second caller**, against this repo's usual rule. `app` has Lighthouse and no E2E; `gildstone` has E2E — already as a local `workflow_call` body — and no Lighthouse. They are the same gattung (Laravel plus a JS frontend), so each holds the half the other is missing. `oggsbreinig` is a third repo of that shape with no `ci.yml` yet, and `saas-template` exists to produce more. Waiting there would mean the third repo starts by copying eighty lines.

What stays repo-owned: the **deploy jobs** in `app`, `infrastructure`, `linear-github-sync` and `discord-presence-bot`.

## 🚀 Setup

Add the stub to the calling repo. It carries the trigger and nothing else:

```yaml
# .github/workflows/promotion-pr.yml
name: Promotion PR
on:
  push:
    branches: [dev, stage]
jobs:
  promotion-pr:
    name: Promotion PR
    uses: kirchDev/workflows/.github/workflows/_promotion-pr.yml@9f3c1a2 # v0.1.0
```

Then delete the body that used to live in that file. Nothing else moves. List `stage` in the trigger even on a repo that has no `stage` branch — a filter naming a branch that doesn't exist is a no-op, and it keeps the stub identical everywhere.

> [!IMPORTANT]
> A called workflow's jobs report as `<caller-job> / <body-job>`, so the check that was `Open or update dev → main PR` becomes `Promotion PR / Open or update the draft PR`. Any **branch-protection rule requiring the old name keeps waiting for a check that will never arrive.** Update the rule in the same change, once per repo.

## ✨ Features

- **🤖 Body and stub** — the trigger stays in the repo it fires in, the logic lives here. A stub is 8 lines and has nothing left to drift.
- **🧭 Topology detection** — the promotion PR finds its own target by asking whether a `stage` branch exists. No flag, no second variant.
- **🛡️ Pinned by SHA** — callers pin a commit, so a push here reaches nobody until a bump PR is reviewed and merged.
- **🔐 Named secrets** — a stub hands over exactly what its body needs, never `secrets: inherit`.
- **🧪 Dogfooded** — this repo carries the same stub as everyone else and calls its own bodies by local path, so a broken body fails here first.

## 🔁 Promotion PR & branch topology

The estate runs two branch flows, and `_promotion-pr.yml` detects which one it is in rather than being configured for it:

| Push to | `stage` exists? | Draft PR opened |
| :------ | :-------------- | :-------------- |
| `dev`   | no              | `dev` → `main`  |
| `dev`   | yes             | `dev` → `stage` |
| `stage` | yes             | `stage` → `main` |

**The branch topology is the configuration.** Creating a `stage` branch promotes a repo to the three-stage flow; deleting it demotes the repo back. Every repo keeps the same stub either way, which is what stops a second copied variant from existing.

> [!TIP]
> Mark the promotion PR ready and **merge it with a merge commit, never a squash**. Squashing collapses the individual `feat:`/`fix:` commits into the PR's own `chore:` title, and release-please then cuts nothing.

If the topology changes while a promotion PR is open, the workflow warns on the run rather than retargeting a PR someone may already be reviewing. Retarget or close it by hand.

## 🔒 Queue landing

Two bodies carry the AI drain's queue: `_queue-branch.yml` cuts the branch the worker PRs are grouped behind, `_fast-forward-queue.yml` opens its PR and lands it by fast-forward once a human has approved it.

Both derive what the old copies configured by hand:

| Value | Old copies | Body |
| :--- | :--- | :--- |
| Integration branch | `env: INTEGRATION_BRANCH`, kept in step with the trigger by hand | read off the PR's base, or resolved from whether `dev` exists |
| Bitwarden secret id | a literal per owner, wrong in four repos | `github.repository_owner` |
| Queue branch prefix | `env:` in every copy, identical in all 47 | fixed in the body — estate policy, never per-repo |

**The dispatch stays in the calling repo, and that is structural.** A reusable workflow cannot be dispatched — `workflow_call` is its only trigger — so the `workflow_dispatch` that lands a queue branch has to live in the stub. ADR-0008's human gate therefore provably remains in the repo it protects, while the 375 lines of picking, approval-checking and patching move here.

```yaml
# .github/workflows/fast-forward-queue.yml — the stub's job block
jobs:
  fast-forward-queue:
    name: Fast-forward Queue
    permissions:
      contents: read
      pull-requests: read
      checks: read
      statuses: read
    uses: kirchDev/workflows/.github/workflows/_fast-forward-queue.yml@9f3c1a2 # v0.1.0
    with:
      pr: ${{ inputs.pr }}
    secrets:
      BWS_ACCESS_TOKEN: ${{ secrets.BWS_ACCESS_TOKEN }}
```

> [!IMPORTANT]
> `_fast-forward-queue.yml` gained a `Resolve the integration branch` job that the old copies did not have — it is where the `env:` literal went. It reports as a new check, and the three jobs that follow it now depend on it.

## 🔐 Reference policy & secrets

**Callers pin a commit SHA**, with the version as a trailing comment — the same way this repo pins `actions/checkout` and `bitwarden/sm-action`. Moving tags are published and work: every release moves `v<major>` onto itself, so `@v0` follows the newest `v0.x.y` exactly as `actions/checkout@v7` does. The stubs use a SHA anyway, and Dependabot raises the bumps — the alias exists for callers who want the other trade.

That review gate is the point. `queue-branch.yml` and `fast-forward-queue.yml` read a PEM from Bitwarden and mint a GitHub App token whose entire purpose is bypassing merge gates on integration branches. On a moving ref, write access to this repo would be unreviewed write access to every repo in the estate.

**Secrets are named, never inherited:**

```yaml
jobs:
  queue:
    uses: kirchDev/workflows/.github/workflows/_queue-branch.yml@9f3c1a2 # v0.1.0
    secrets:
      BWS_ACCESS_TOKEN: ${{ secrets.BWS_ACCESS_TOKEN }}
```

`secrets: inherit` would hand a body everything the calling repo holds — including secrets added long after anyone read the stub.

> [!NOTE]
> The Bitwarden **secret ids** in the workflow bodies are vault identifiers, not credentials: they name an entry that only `BWS_ACCESS_TOKEN` can open, and that token is a GitHub secret which never appears in a file.
>
> The id differs per owner, so every body derives it from `github.repository_owner` rather than carrying a literal. That is not tidiness: as a literal it was wrong in **four repos for the Queue App and two more for the Release App** — a mismatch resolves for nobody, silently, until someone dispatches the workflow. Deriving it makes the error impossible.

## 🔍 CodeQL

One body, one pin. The 15 copies it replaces differed in almost nothing else: `v4`, `v4.37.3`, `v4.37.4`, `v4.37.8`, `v4.37.9` and a raw SHA were all in circulation for the same two steps.

The one real axis is the language set, so it is the one input:

```yaml
jobs:
  codeql:
    uses: kirchDev/workflows/.github/workflows/_codeql.yml@9f3c1a2 # v0.1.0
    with:
      languages: '["actions", "go", "javascript-typescript"]'
```

Omit `languages` for the default `["actions", "javascript-typescript"]`. Adding `go` is enough on its own — the body switches that language to `build-mode: autobuild` and runs `setup-go`, because CodeQL rejects `none` for Go. In the copied files, adding Go meant forking the whole workflow.

## 🏷️ Releases

`_release-please.yml` opens the release PR and cuts the tag under the kirchDev Release App. **Publishing is a separate body per target**, composed by the caller — because 10 of the 22 repos publish nothing at all, and npm and GoReleaser need different secrets:

```yaml
jobs:
  release-please:
    permissions:
      contents: write
      pull-requests: write
    uses: kirchDev/workflows/.github/workflows/_release-please.yml@9f3c1a2 # v0.1.0
    secrets:
      BWS_ACCESS_TOKEN: ${{ secrets.BWS_ACCESS_TOKEN }}

  publish:
    needs: release-please
    if: needs.release-please.outputs.release-created == 'true'
    uses: kirchDev/workflows/.github/workflows/_publish-npm.yml@9f3c1a2 # v0.1.0
    with:
      tag-name: ${{ needs.release-please.outputs.tag-name }}
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Which body a repo composes on:

| Target | Repos | Body | Passes |
| :--- | ---: | :--- | :--- |
| nothing | 10 | — | — |
| npm | 4 | `_publish-npm.yml` | `tag-name`, `NPM_TOKEN` |
| Terraform registry | 3 | `_publish-goreleaser.yml` | `tag-name`, `BWS_ACCESS_TOKEN` |
| a deployment | 4 | own job | — |

> [!IMPORTANT]
> Two of the four npm repos were missing the prerelease-version fix the other two carry: because release-please bumps the version on `main` only, a `dev` branch published a version semver ranked **below** the latest release, so `@dev` resolved to something older than `@latest`. The body derives the base from the last published release instead. Migrating `forgemap` and `envprism` onto it is a fix, not a port.

The prerelease job is a second call with `prerelease: true`; it gates itself on the branch rather than on `release-created`.

## 🧪 CI

CI is the one place where a body is a **job**, not a whole workflow. A single body with `run-test`, `run-coverage`, `needs-postgres` switches would turn every stub into a config file — and a value the caller maintains is a copy, which is the thing this repo exists to remove.

For the 11 Node repos whose CI is a set of checks, the stub is two lines of job:

```yaml
jobs:
  check:
    name: CI
    uses: kirchDev/workflows/.github/workflows/_ci-check.yml@9f3c1a2 # v0.1.0
```

**One job per check, and the list is derived.** Each repo already declares its checks in `package.json`, in order — `"check": "pnpm lint && pnpm format && pnpm typecheck && pnpm check:policy"` — and the copied workflows listed those same commands a second time as steps. The body splits the gate script into its `pnpm <task>` calls and fans them out over a matrix, so each check reports on its own as `CI / Check (typecheck)`, they run in parallel, and any one of them can be a required check by itself.

It resolves recursively, because a gate can chain another aggregate — `skills` runs `verify`, which calls `check`, which is `lint && format`:

| Repo | Resolved checks |
| :--- | :--- |
| `meta` | lint, format, typecheck, **validate** |
| `gitignore-sync` | lint, format, typecheck, **check:policy**, test |
| `skills` | lint, format, **skills:check**, typecheck, test |

The repo-specific ones come along without being listed anywhere here. Adding a check stays a `package.json` edit that CI picks up with no workflow change.

A repo whose gate lives under another name passes it:

```yaml
    with:
      gate-script: verify
```

**One job, one step per check — not a matrix.** Jobs share nothing: separate runner, separate filesystem, separate `node_modules`. Fanning four ten-second tasks over four jobs means four checkouts and four installs, which for a one-to-two-minute run makes it slower and burns four runners instead of one. Each task gets its own log group and its own error line instead, so a red build still names the check that failed. The matrix earns its overhead in the Laravel and Go bodies, where a single job runs for minutes and where `test` should be a required check on its own.

### Skipping work that cannot fail

Two bodies cut runtime without touching a pipeline. They are complementary — one skips a run whose bytes already passed, the other skips jobs a change cannot affect:

```yaml
jobs:
  verified:
    uses: kirchDev/workflows/.github/workflows/_verified.yml@9f3c1a2 # v0.1.0

  check:
    needs: verified
    if: needs.verified.outputs.skip != 'true'
    uses: kirchDev/workflows/.github/workflows/_ci-check.yml@9f3c1a2 # v0.1.0

  record-verified:
    needs: [verified, check]
    if: needs.check.result == 'success'
    uses: kirchDev/workflows/.github/workflows/_record-verified.yml@9f3c1a2 # v0.1.0
    with:
      tree: ${{ needs.verified.outputs.tree }}
```

The marker keys on the **tree hash**, so it names the content rather than the commit — two commits share a marker only when every byte matches. It is a git ref, not `actions/cache`, because the cache is branch-scoped and a marker written on `dev` would be invisible on `stage`. It fails open: no answer means a full run, never a skipped one.

**Which jobs the marker stands for is the caller's decision** — that is why `record-verified` takes its `if:` in the stub. Gating it on lint alone would record a tree as verified that was never tested.

### When a body almost fits

A body is taken whole or not at all — there is no way to override one step. For that case each Node body's setup also exists as a composite action, which runs **in your own job**:

```yaml
jobs:
  custom:
    runs-on: ubuntu-latest
    steps:
      - uses: kirchDev/workflows/.github/actions/setup-node-pnpm@9f3c1a2 # v0.1.0
      - run: pnpm something-only-this-repo-does
```

So a repo that needs a body plus one extra step writes its own job instead of forking the body.

> [!NOTE]
> The bodies here deliberately do **not** use that action. A reusable workflow resolves `./…` against the **caller's** workspace rather than its own repository, so a body would have to name `kirchDev/workflows/…@<ref>` in full — and `uses:` takes no expression, so that ref would be hard-coded. A caller pinning the body to one SHA would then silently run an action from another. Four duplicated setup lines are cheaper than a pin that lies.

## 🤝 Contributing

PRs welcome. Conventional Commits required (enforced via commitlint). Husky runs the project's linters/formatters on `git commit`.

> [!TIP]
> Run `pnpm check:fix` before pushing — CI will catch what husky missed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## 🛣️ Versioning

[Semantic Versioning](https://semver.org/) via [release-please](https://github.com/googleapis/release-please) — see [CHANGELOG.md](CHANGELOG.md).

Here the tags are the interface: every caller pins one, so a release is never cosmetic and a tag is never moved or deleted once published.

## 📄 License

[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)
