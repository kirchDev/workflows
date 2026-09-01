---
title: 'Compose CI from bodies that are jobs'
description: 'A CI body is a job the caller composes into its own pipeline, never one body with switches for the parts a repo does not run.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0004 — Compose CI from bodies that are jobs

## Context

CI was the workflow that had drifted furthest: measured across the estate, nearly every repo's copy was unique. Behind that were a handful of families — repos running a single gate, libraries running a typecheck-test-build set, packages running a version matrix against a database, providers running a language toolchain — and a few repos with pipelines that genuinely belong to them, carrying deploy stages and their own short-circuits.

Unlike the queue workflows, the differences here are not values a body can look up. Whether a repo needs a database, which toolchain it installs and what "tested" means for it are properties of its stack, not of its state.

## Decision

A CI body is a **job** that a caller composes into a pipeline it still owns, and there is one body per family rather than one body for CI.

Inputs on such a body say what the body cannot know — which versions a matrix spans, which paths a filter watches. They never say which parts of the body to skip.

## Consequences

A repo keeps its own pipeline and its own graph: it decides what runs, in which order, and what a short-circuit is allowed to stand for. The bodies it calls do not need to know about each other.

Repos with pipelines of their own are not special cases to be worked around — they compose from the same pieces as everyone else, which is why the pieces were cut at job boundaries in the first place.

Adding a family means adding a body. Writing one before a second caller exists is a cost taken deliberately, and only where a named repo would otherwise start by copying the first one.

A caller's pipeline is longer than a single `uses:` line, and the composition itself — which job needs which, what gates on what — is the one thing that can still drift between repos.

## Alternatives considered

**One CI body with feature switches** — flags for running tests, for needing a database, for a coverage step. It works. It also turns every stub into a configuration file of a dozen keys, which is the drift this repository removes, reappearing one level up. It would still have left the repos with their own pipelines as special cases, and those carry the most logic.

**One body per repo.** The starting point, and what was being replaced.
