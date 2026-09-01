---
title: 'Publish with one body per target'
description: 'Releasing and publishing are separate bodies, and a caller composes the publish body its target needs.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0005 — Publish with one body per target

## Context

The release workflow and the publish step arrived as one file in every repo that had them. Most repos that cut releases publish nothing at all — they exist to be depended on by their own tags, or they deploy instead. The ones that do publish split by target, and the targets need different credentials: a registry token for one, a signing key out of the vault for another.

A single body serving all of them would have to make every credential optional, which erases the signal of which one a repo actually needs, and would ask the repos that publish nothing to carry inputs they have no use for.

## Decision

Releasing is one body. Publishing is a separate body per target, and the caller composes the one it needs, gated on whether a release was actually created.

## Consequences

A repo that publishes nothing calls one body and passes one secret. A repo that publishes states which target it publishes to by which body it calls — the stub says what the repo is.

Adding a target means adding a body, not adding a branch to an existing one, and the repos that do not use it are unaffected by its existence.

The caller now writes the wiring between the two jobs, so the gate on "a release was created" is stated once per repo rather than once in a body. That wiring is duplicated across the repos publishing to the same target, and it is the piece that could drift.

Repos that deploy rather than publish keep their own jobs. Those touch environments rather than artifacts, and centralising them was never in question.

## Alternatives considered

**One body with a `target` input.** Every secret optional, every publishing repo passing a flag, and the repos that publish nothing carrying the surface anyway.

**Publishing folded into the release body.** The same problem with fewer files, and it would have made the release body untouchable for the majority of callers that only want a tag.
