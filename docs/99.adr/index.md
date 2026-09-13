---
title: 'Architecture decisions'
description: 'The decision log — every architecture decision recorded for this repository.'
icon: 'lucide:gavel'
---

A decision earns an ADR when it constrains work that comes later and its reasoning would otherwise be lost: a choice between real alternatives, a convention every part of the project has to follow, a trade-off that looks like a mistake until the reason is known. Records are append-only — a reversed decision is written as a new ADR that supersedes the old one, never as an edit to it.

This log holds decisions about **this repository**: what a body may assume, what a caller must state, and where the boundary between the two runs. Decisions about the estate's provisioned state — branch protection, the queue App, the secret mirror — belong to `kirchDev/infrastructure` and are recorded there; the bodies here implement them and cite them by id.

| ADR                                                                 | Decision                                      | Status   | Date       |
| :------------------------------------------------------------------ | :-------------------------------------------- | :------- | :--------- |
| [ADR-0001](/adr/0001-derive-a-bodys-configuration-from-the-repo)    | Derive a body's configuration from the repo   | Accepted | 2026-09-01 |
| [ADR-0002](/adr/0002-pin-callers-to-a-commit-sha)                   | Pin callers to a commit SHA                   | Accepted | 2026-09-01 |
| [ADR-0003](/adr/0003-name-every-secret-a-stub-passes)               | Name every secret a stub passes               | Accepted | 2026-09-01 |
| [ADR-0004](/adr/0004-compose-ci-from-bodies-that-are-jobs)          | Compose CI from bodies that are jobs          | Accepted | 2026-09-01 |
| [ADR-0005](/adr/0005-publish-with-one-body-per-target)              | Publish with one body per target              | Accepted | 2026-09-01 |
| [ADR-0006](/adr/0006-keep-the-composite-action-out-of-the-bodies)   | Keep the composite action out of the bodies   | Accepted | 2026-09-01 |
| [ADR-0007](/adr/0007-run-the-gate-as-one-job-with-a-step-per-check) | Run the gate as one job with a step per check | Accepted | 2026-09-01 |
| [ADR-0008](/adr/0008-give-each-reporter-its-own-comment-thread)     | Give each reporter its own comment thread     | Accepted | 2026-09-01 |
| [ADR-0009](/adr/0009-write-a-body-before-its-second-caller)         | Write a body before its second caller         | Accepted | 2026-09-01 |
