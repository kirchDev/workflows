# Security Policy

## Scope

`workflows` holds the **reusable GitHub Actions workflow bodies** called by every other repository in the kirchDev estate. It is not a runtime package, but it is load-bearing in a way a template never was: a caller pins a ref here and executes whatever that ref contains, inside the caller's own repository.

Two of the bodies — `queue-branch.yml` and `fast-forward-queue.yml` — read a PEM from Bitwarden and mint a GitHub App token whose purpose is to bypass merge gates. A flaw in those has estate-wide reach, which is why callers pin every body to a commit SHA rather than a moving tag.

The supported "version" is the **tip of `main`** plus whatever tags callers currently pin. A fix ships as a new tag; callers pick it up via a Dependabot bump.

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security problems.**

In the context of this repository, a "vulnerability" typically means:

- An insecure default in a reusable workflow body (e.g. overly broad `permissions`).
- A path by which a caller's secrets reach a step that should not see them.
- An unpinned or compromised third-party Action used inside a body.
- A weakness in the token-minting path of `queue-branch.yml` / `fast-forward-queue.yml`.

Use one of the following private channels:

1. **GitHub Private Vulnerability Reporting** (preferred): open a private advisory at <https://github.com/kirchDev/workflows/security/advisories/new>.
2. **Email**: [titus.kirch@kirch.dev](mailto:titus.kirch@kirch.dev). PGP available on request.

Please include:

- A description of the vulnerability and its impact on calling repositories.
- Steps to reproduce.
- Any suggested fix, if you have one.

### What to expect

| Stage                        | Target timeline                                   |
| :--------------------------- | :------------------------------------------------ |
| Acknowledgement of report    | within **3 business days**                        |
| Initial assessment & triage  | within **7 business days**                        |
| Patch released (if accepted) | depends on severity — critical issues prioritised |
| Public disclosure & advisory | coordinated with reporter after the patch ships   |

## Credit

Reporters who follow this process responsibly are credited in the [CHANGELOG](CHANGELOG.md) and the corresponding GitHub Security Advisory, unless they prefer to remain anonymous.

---

Maintained by [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev).
