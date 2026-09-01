---
title: 'Keep the composite action out of the bodies'
description: 'The shared setup exists as a composite action for callers, but the bodies duplicate the steps rather than calling it.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0006 — Keep the composite action out of the bodies

## Context

A reusable workflow is taken whole. A caller cannot replace one of its steps or insert another, so a repo needing "that body plus one thing" has to write its own job — which is why the setup those bodies open with also exists as a composite action it can call.

Using that same action inside the bodies looks like the obvious next step, and it is a trap. A relative `uses:` inside a reusable workflow resolves against the **caller's** workspace, not against the repository the body lives in, so a body cannot say `./`. It would have to name this repository and a ref in full — and `uses:` accepts no expression, so that ref could not be the one the caller pinned. It would be a literal, fixed at the time the body was written.

A caller pinning a body to one commit would then run a body from that commit and a setup action from a different one, with nothing anywhere saying so.

## Decision

The bodies do not call the composite action. They repeat the few setup steps inline. The action exists for callers writing their own jobs.

## Consequences

A pinned SHA means what it appears to mean: everything the run executes out of this repository comes from that commit.

The setup steps exist in both places, so a change to how the toolchain is set up has to be made in the bodies and in the action, and nothing checks that the two agree.

A repo that needs a body plus one step writes its own job around the action instead of forking the body, which keeps the fork pressure off the bodies.

## Alternatives considered

**Calling the action with a hardcoded ref.** Removes the duplication and introduces a pin that lies. The duplication is a handful of lines; the pin would be a silent inconsistency at every caller.

**Making the setup its own reusable workflow.** A workflow cannot be a step inside a job, so this does not address the case at all.
