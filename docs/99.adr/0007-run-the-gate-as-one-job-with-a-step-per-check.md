---
title: 'Run the gate as one job with a step per check'
description: 'The gate body derives its task list from the repo package manifest and runs the tasks as steps of a single job rather than fanning them over a matrix.'
status: 'accepted'
date: '2026-09-01'
---

# ADR-0007 — Run the gate as one job with a step per check

## Context

For the repos whose CI is a set of independent checks, the copied workflows listed those checks a second time as steps — the same commands the package manifest's gate script already chained, kept in step by hand.

Deriving the list from the gate script removes that second copy, and it also decides nothing about how the tasks then run. Two shapes were available: fan them out over a matrix so each reports as its own job, or run them as steps of one job.

The tasks in question are short. A run for these repos is dominated by checkout and dependency install, not by the checks themselves.

## Decision

The gate body splits the repo's gate script into its task calls, expanding a task that chains another aggregate, and runs the result as **steps of a single job**. Each task gets its own log group and its own error line, so a failed run names the check that failed.

## Consequences

The check list follows the repo. A repo adds a check by editing its gate script, and CI picks it up with no workflow change — which is what carries the checks that exist in only one repo, without any of them being named here.

A run costs one checkout and one install rather than one per task.

What is given up is granularity at the job level: the whole gate is one check name, so a single aspect of it cannot be required on its own, and the tasks do not run in parallel. The first task to fail ends the job, so a run reports one failure rather than all of them.

A task that takes arguments is left unexpanded, because running it on its own would not be the same command.

## Alternatives considered

**A matrix, one job per task.** It gives each check its own name and lets any one of them be required alone. Jobs share nothing — separate runner, separate filesystem, separate dependency tree — so n tasks cost n checkouts and n installs. For a gate of short tasks that makes the run slower while occupying several runners instead of one. The trade reverses where a single task runs for minutes, which is why the bodies for the heavier stacks do use a matrix.

**Running the gate script as one command.** One step, no derivation, and a red build that does not say which check failed.
