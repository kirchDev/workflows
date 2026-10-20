---
title: 'Extend the PEM secret to the queue and regenerated-PR bodies'
description: 'The queue bodies take QUEUE_APP_PRIVATE_KEY and run a separate Kirch & Ostendorf Queue App; _open-regenerated-pr.yml takes RELEASE_APP_PRIVATE_KEY.'
status: 'accepted'
date: '2026-10-20'
---

## Context

[ADR-0011](/adr/0011-accept-the-release-app-pem-as-a-secret-where-bitwarden-is-absent) let `_release-please.yml` take the Release App PEM as a secret for `sirargonNet` and `kirch-ostendorf`, which have no Bitwarden in CI. It left the other bodies that mint an App token on Bitwarden until one of those owners called them. They now do: their repos want the AI queue and regenerated-file PRs too.

The queue bodies cannot reuse the Kirch & Ostendorf Release App. The Queue App is the merge-gate bypass actor on the integration branch, and `kirchDev/infrastructure` keeps it apart from the Release App on purpose — one App, one purpose (ADR-0008, ADR-0010 and ADR-0011 there). So those two owners get a Kirch & Ostendorf Queue App, owned by `kirch-ostendorf`, installed in both, with the kirchDev Queue App's permissions: `contents: write`, `pull_requests: write`, `metadata: read`.

## Decision

`_queue-branch.yml` and `_fast-forward-queue.yml` take an optional `QUEUE_APP_PRIVATE_KEY` secret, and `BWS_ACCESS_TOKEN` becomes optional. An owner table picks the client id — kirchDev Queue App for `kirchDev` and every other owner, Kirch & Ostendorf Queue App for `sirargonNet` and `kirch-ostendorf` — and the vault id, which those two owners do not have. A set key wins over Bitwarden; a missing one fails with a named error in the job that would mint. `_fast-forward-queue.yml` resolves the table once in its `resolve` job, so all three jobs read one answer.

`_open-regenerated-pr.yml` already opened its PR with the owner's Release App PEM, so it follows ADR-0011 exactly: an optional `RELEASE_APP_PRIVATE_KEY`, and for `sirargonNet` and `kirch-ostendorf` the Kirch & Ostendorf Release App. Its `app-id` input becomes optional, because for those owners only one App fits the key; kirchDev and TitusKirch callers keep passing it.

## Consequences

kirchDev and TitusKirch callers change nothing and see the same vault ids and the same Apps. The queue bodies mint with the kirchDev Queue App's client id instead of its numeric id; that is the same App and the same token. No job is renamed, so no check name moves.

A `sirargonNet` or `kirch-ostendorf` repo carries a second hand-set PEM secret, `QUEUE_APP_PRIVATE_KEY`, rotated by hand like `RELEASE_APP_PRIVATE_KEY`.

## Alternatives considered

**Use the Kirch & Ostendorf Release App for the queue.** Fewer secrets, and it would give the release identity the merge-gate bypass. Rejected for the reason the infrastructure ADRs give.

**Make the client id an input.** A caller would state what the owner already decides. Rejected under ADR-0001.
