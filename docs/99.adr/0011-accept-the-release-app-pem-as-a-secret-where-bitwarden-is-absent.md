---
title: 'Accept the Release App PEM as a secret where Bitwarden is absent'
description: '_release-please.yml takes the PEM as an optional RELEASE_APP_PRIVATE_KEY secret for owners whose CI cannot read Bitwarden.'
status: 'accepted'
date: '2026-10-20'
---

## Context

Every body reads its App PEM from Bitwarden at runtime with `BWS_ACCESS_TOKEN`. kirchDev never writes a PEM into a GitHub secret: the master copy lives in Bitwarden and is mirrored into each owner's `-ci` project (`kirchDev/infrastructure`, `docs/2.concepts/3.secret-management.md`).

`sirargonNet` and `kirch-ostendorf` release under the Kirch & Ostendorf Release App, and both are on Bitwarden's free plan. They will not hand CI a Bitwarden token, so the body's only path to the key is closed for them.

## Decision

`_release-please.yml` takes an optional `RELEASE_APP_PRIVATE_KEY` secret. When it is set, the body uses it as the App key and skips Bitwarden; when it is not, the body reads Bitwarden exactly as before. `BWS_ACCESS_TOKEN` becomes optional so such a caller does not have to pass it.

The owner table keeps choosing the client id. `sirargonNet` and `kirch-ostendorf` have no vault id in it, and the body fails with an error if one of them calls without the key, or if any caller passes neither secret.

kirchDev and TitusKirch keep the Bitwarden path. The body would accept the key from them too, but their callers do not pass it: the exception is for owners without Bitwarden, not a second way for everyone.

## Consequences

For those two owners the PEM is a GitHub secret, set and rotated by hand per owner, with no mirror keeping it in step. That is the trade the free plan forces.

kirchDev callers see no change: they still pass `BWS_ACCESS_TOKEN`, and the body still reads the same vault ids. A caller that passes nothing now fails in the resolve step with a named error instead of inside `sm-action`.

Other bodies that mint an App token (`_open-regenerated-pr.yml`, the queue bodies) still require Bitwarden. They get the same secret only once an owner without Bitwarden calls them.

## Alternatives considered

**A Bitwarden token for those owners.** The uniform answer, and refused by the owners on cost.

**An input naming the key source.** A caller would have to state what the body can already see: whether the secret is set. Rejected under ADR-0001.
