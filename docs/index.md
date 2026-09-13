---
title: 'workflows documentation'
description: 'How a repo moves onto the central reusable workflow bodies, how a new body is written, and the decisions that govern both.'
icon: 'lucide:book-open-text'
navigation: false
---

This repository holds the estate's reusable GitHub Actions workflow bodies. Every other repo carries a thin caller stub instead of its own copy, so a fix lands once and reaches each repo on its next bump.

These pages cover the two tasks the repository asks of a person — moving a repo onto a body, and writing a new one — and the decision log behind them.

## Sections

::page-cards
::

What the bodies do, how a stub looks and what each one needs is in the [README](https://github.com/kirchDev/workflows/blob/main/README.md); how to set the repo up and get a PR landed is in [CONTRIBUTING.md](https://github.com/kirchDev/workflows/blob/main/CONTRIBUTING.md). Decisions about the estate's provisioned state — branch protection, the queue App, the Bitwarden mirror — are recorded in `kirchDev/infrastructure`, not here.
