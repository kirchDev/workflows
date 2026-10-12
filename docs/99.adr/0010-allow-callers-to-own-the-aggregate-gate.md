---
title: 'Allow callers to own the aggregate gate'
description: 'Composed pipelines may replace redundant body gates with one required caller gate.'
status: 'accepted'
date: '2026-10-12'
---

## Context

A composed pipeline already aggregates every reusable call into its own required
check. Each additional body gate starts another runner after its checks finish.
The caller's branch-protection choice cannot be derived from its source tree.

## Decision

The Check, Rust and Gradle bodies accept `gate`, defaulting to `true`. A caller
may set `gate: false` only when its own aggregate gate depends on every reusable
call and rejects failed or cancelled results. Verify branch protection names
that aggregate before opting out. Existing check names and defaults stay stable.

This supersedes ADR-0004's prohibition on skip inputs solely for the aggregate
gate. No compilation, test, lint or security check is skipped by this input.

## Consequences

Composed pipelines avoid redundant runner starts. Simple callers keep their
stable body gate. The composed caller owns testing its dependency graph and
failure propagation; a successful aggregate must never conceal a failed check.
