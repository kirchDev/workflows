---
title: 'Name every secret a stub passes'
description: 'A caller passes each secret a body needs explicitly; secrets: inherit is not used.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0003 — Name every secret a stub passes

## Context

A caller can hand a reusable workflow everything it holds in one word. That word is shorter than a block naming each secret, and it never needs touching again when a body grows a new requirement.

It also decides, once, that every secret the repository acquires from then on is visible to every body it calls — including secrets added long after anyone last read the stub, and including bodies added to the call after that.

## Decision

A stub passes exactly the secrets its body declares, one key at a time. `secrets: inherit` is not used.

## Consequences

What a body can reach is stated in the file that grants it, so the answer to what a workflow can read is the stub itself rather than the repository's whole secret list.

A body that starts needing another secret cannot get it silently: every caller has to be edited, which is a visible change and a reviewed one.

That is also the cost — such a change is a pull request per calling repo, and until each lands the body fails there rather than degrading.

## Alternatives considered

**`secrets: inherit`.** One line per stub instead of two or three, and no edit when a body's needs change. Rejected for exactly the second property.
