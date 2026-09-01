---
title: 'Pin callers to a commit SHA'
description: 'Caller stubs reference a body by commit SHA with the version as a trailing comment; the moving major alias is published but opt-in and off by default.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0002 — Pin callers to a commit SHA

## Context

A caller has to name a ref. A moving major tag is the conventional choice and the one the marketplace actions themselves offer, and this repository can move such a tag: release-please cuts exact tags, and the release workflow can force-push `v<major>` onto each one.

What makes the choice not obvious is what some of these bodies do. The queue workflows read a private key out of the secret vault and mint a GitHub App token whose entire purpose is to bypass a merge gate on an integration branch. On a moving ref, anyone able to push a commit here would be able to change what that token is used for in every repo that calls it, with no review in any of them.

## Decision

Caller stubs pin a full commit SHA, with the version as a trailing comment. Bumps arrive as dependency-bot pull requests, and reviewing one of those is the gate.

The moving `v<major>` alias is published for callers who want the other trade, but it is opt-in per repository and off by default.

## Consequences

Write access to this repository is not, by itself, write access to every repository in the estate. A change reaches a caller only when someone merges the bump.

Every repo is therefore behind by however long its bump PR sits, including for a fix, and a security fix reaches the estate at the speed of review rather than at the speed of a push.

The trailing comment is the only thing that tells a human which version a stub is on, and nothing enforces that it stays truthful.

The alias defaults to off because moving a tag is a hazard where something else reads the tag list as a version list — for a published package the registry version is what resolves, and for a Terraform provider an extra unversioned tag is not valid semver at all.

## Alternatives considered

**A moving major tag as the default.** One less thing for every repo to bump, at the price of the review gate above. It stays available to any repo that opts in.

**A branch as the ref.** The same exposure with no version information at all.
