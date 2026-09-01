---
title: 'Give each reporter its own comment thread'
description: 'A body that reports to a pull request owns its own sticky marker, rather than several reporters sharing one comment.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0008 — Give each reporter its own comment thread

## Context

Two of the bodies write results back to a pull request: coverage, and the performance audit. The repository they were derived from had collected both into a single comment, and said why — a second reporting job beside it would open a second thread, and a pull request carrying a thread per metric is one nobody reads.

That reasoning holds for a pipeline written in one file. It does not survive being split into bodies that repos compose independently. A repo calling the coverage body alongside the combined job would get the second thread anyway, because the two know nothing about each other; and coupling them so they do not would mean one body reading another's output, which is the shape the split was meant to avoid. Either the reporters share a marker and are no longer independent, or they are independent and there is more than one thread.

## Decision

Each reporting body owns its own sticky marker and posts under it alone. Coverage keeps the marker its action already writes; the audit posts under its own. Neither body knows the other exists.

## Consequences

A pull request in a repo that runs both carries two comment threads instead of one. That is the cost, and it is paid on every such pull request.

What it buys is that either body can be adopted without the other, dropped without touching the other, and changed without a second body's output shifting. It also removes the last reason the combined job could not be replaced: it was blocked by this coupling rather than by a missing second caller.

The markers now have to stay distinct by convention, since nothing enforces it — a body colliding with another's marker would silently overwrite its report.

## Alternatives considered

**One shared marker, written by whichever body runs last.** Keeps a single thread, and makes the last writer responsible for content it did not produce — a body would have to read another's artifact to avoid erasing it. The coupling that was being removed, reintroduced at the comment level.

**One reporting body aggregating the others.** A single thread again, at the price of a body that must know every reporter that exists, and must be extended before any new one can report anything.
