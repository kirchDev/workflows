# Contributing to workflows

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting issues

- **Questions, ideas, possible bugs**: the [Discord forum](https://discord.kirch.dev/).
- **Confirmed bugs**: a [Bug report](https://github.com/kirchDev/workflows/issues/new?template=bug_report.yml) with a minimal reproduction.
- **Feature requests**: a [Feature request](https://github.com/kirchDev/workflows/issues/new?template=feature_request.yml).
- **Security vulnerabilities**: never a public issue — see [SECURITY.md](SECURITY.md).

## Development setup

Requires Node **26** (`.nvmrc`), **pnpm 12**, `git`, and Docker for `pnpm lint:actions`.

```bash
git clone https://github.com/kirchDev/workflows.git
cd workflows
pnpm install   # wires husky hooks
```

`pnpm check` is the gate CI runs; `pnpm check:fix` fixes lint and format. Every script is listed in [AGENTS.md](AGENTS.md#commands).

## Branching & PRs

1. **Branch off `dev` and open the PR into `dev`.** Never push to `main` or `dev` directly.
2. **Conventional Commits**, enforced by commitlint — e.g. `fix(queue): read the PEM from this owner's mirror`; breaking: `feat!:` or a `BREAKING CHANGE:` footer. Only `feat` and `fix` cut a release.
3. **One concern per PR**, docs updated when a default changes.
4. **Don't `--no-verify`.** The hooks run lint-staged and commitlint; fix what they report and commit again.

## AI agents

Agent rules live in [AGENTS.md](AGENTS.md). Claude Code loads it on its own from v2.1.277, as long as no `CLAUDE.md` or `CLAUDE.local.md` sits in the working directory or above.

## License

Contributions are licensed under the [MIT License](LICENSE).
