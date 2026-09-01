---
title: 'workflows documentation'
description: 'How a repo moves onto the central reusable workflow bodies, how a new body is written, and the decisions that govern both.'
---

# workflows

This repository holds the estate's reusable GitHub Actions workflow bodies. Every other repo carries a thin caller stub instead of its own copy, so a fix lands once and reaches each repo on its next bump.

These pages cover the two tasks the repository asks of a person — moving a repo onto a body, and writing a new one — and the decision log behind them.

## Sections

- [Guides](1.guides/) — migrating a repo onto a stub, and adding a body.
- [Architecture decisions](99.adr/) — the decision log.

What the bodies do, how a stub looks and what each one needs is in the [README](../README.md); how to set the repo up and get a PR landed is in [CONTRIBUTING.md](../CONTRIBUTING.md). Decisions about the estate's provisioned state — branch protection, the queue App, the Bitwarden mirror — are recorded in `kirchDev/infrastructure`, not here.
