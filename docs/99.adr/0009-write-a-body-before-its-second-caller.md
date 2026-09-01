---
title: 'Write a body before its second caller'
description: 'A body may be written for a single caller when a specific repo is known to need it next, and the reasoning is recorded with the body.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0009 — Write a body before its second caller

## Context

The case for centralising a workflow is that several repos carry the same one. Where only a single repo has it, that case is absent: a body written for one caller generalises a shape nobody has met twice, and the input it takes may be the wrong seam.

Refusing every such body has its own cost, and it falls on a repo that does not exist yet. The next repo of a given kind starts from the only version available — a copy, taken whole, from whichever repo happened to have one. A long pipeline copied once is a second variant from its first commit, and the estate's own history is the argument: every workflow being centralised here reached its variant count exactly that way.

Both failure modes are real, so the question is which repo pays: a body generalised too early, or a copy made too late.

## Decision

A body may be written for a single caller when a **named** repo is known to need it next — one that exists, or one a template is expected to produce. The reasoning goes in the body's own header, naming that repo, so a later reader can tell a considered exception from an oversight.

Where no such repo can be named, one instance is not a pattern and no body is written.

## Consequences

A body written this way has had its interface guessed once rather than observed twice. The second caller is likely to need an input that is not there, and adding it is cheap; discovering that the seam itself is wrong is not.

Migrating the first caller onto such a body may rename its checks, which is a branch-protection change in that repo. Accepted deliberately: it happens once, and it happens anyway during the migration.

The rule can be argued into anything, since any repo might one day need any workflow. The requirement that the next caller be _named_ is what keeps it a decision rather than a preference — an unnamed one is a hunch, and a hunch does not clear the bar.

## Alternatives considered

**Wait for the second caller, always.** The rule as it would read without this record. It is right in the common case and wrong exactly where the second caller is a large repo whose copy would be made before anyone noticed.

**Write every body speculatively.** Removes the judgement, and fills the repository with interfaces shaped by a single example, each of which has to be broken when a real second caller arrives.
