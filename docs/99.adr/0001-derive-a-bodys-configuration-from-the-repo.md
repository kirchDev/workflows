---
title: "Derive a body's configuration from the repo"
description: 'A body reads the values that differ per repo out of the repo it runs in, and accepts an input only for what it cannot know.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0001 — Derive a body's configuration from the repo

## Context

The bodies replace workflow files that had been copied into every repo and had drifted apart. Counting the copies made them look irreconcilable — the fast-forward queue workflow existed in eight versions — but the differences between them were not eight problems. They were the integration branch name, a per-owner secret identifier, a runner label, and a group of repos that had never received a fix.

Each of those first values is something the repo already answers. The branch name is decided by the trigger that let the run start; the owner is on every event payload. Carried as a literal, the owner-specific identifier was wrong in several repos at once — a mismatch that resolves for nobody, silently, and surfaces only when someone dispatches the workflow.

A value that a caller supplies is a value the caller maintains, and a maintained value in every repo is the copy this repository exists to remove, one file smaller.

## Decision

A body reads what the repo it runs in can tell it. An input exists only for what a body genuinely cannot know — the languages an analysis should cover, the versions a matrix should span.

Where a body cannot read a value from the event it is triggered by, it resolves it in a job of its own and hands it to the rest through `needs`, rather than accepting it from the caller.

## Consequences

Every calling repo carries the same stub for the same workflow, so two stubs that differ mark a real difference rather than an accident of when they were copied.

A repo changes its behaviour by changing itself. Creating an integration branch moves it to another branch topology and no workflow file changes anywhere — which is the property being bought, and also the surprise: nothing in the stub says the topology is a decision.

A whole class of error stops being possible instead of being fixed in each place it occurred.

The cost is paid at the body: deriving a value takes a job or a step that an input would not have needed, that job's name becomes part of every caller's check names, and a body is harder to exercise in isolation because it now depends on the shape of the repo around it. A repo that wants to deviate from what its own state implies cannot do so from the call site at all.

## Alternatives considered

**An input per value.** Correct, conventional, and the way most reusable workflows are written. It hands each caller a value to keep in step with its own trigger — which is what the copies were doing, expressed in fewer lines.

**A configuration file in the calling repo.** The same objection, one level up, plus a second file to keep in step with the first.

**One body per topology.** This is where the eight variants came from.
