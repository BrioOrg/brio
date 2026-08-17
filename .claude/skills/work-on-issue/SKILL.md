---
name: work-on-issue
description: Start work on a GitHub issue. Use when the user says "work on issue N", "start issue N", or references an issue number to implement.
---

# Working on an issue

Follow these phases in order. Do not skip ahead.

## Phase 1 — Understand
1. Run `gh issue view <N>` to read the issue.
2. Read `docs/adr/README.md` and any ADR relevant to this issue.
3. Read the parts of the codebase the issue touches. Use a subagent
   for exploration if it spans more than a few files.

## Phase 2 — Questions (MANDATORY STOP)
Ask the user every question you have before proposing anything:
- ambiguities in the issue's scope or acceptance criteria
- decisions the issue leaves open
- anything that contradicts an existing ADR
- assumptions you would otherwise make silently

Ask them as a numbered list. Then STOP and wait.
Do not write a plan. Do not touch any file. Do not create a branch.
If you genuinely have no questions, say so explicitly and explain why
the issue is unambiguous — do not skip this phase silently.

## Phase 3 — Plan
After the user answers, propose a plan:
- files to create or modify, and why
- decisions being made that aren't in the issue
- what you will NOT do (scope boundaries)
- how the work will be verified
Wait for approval.

## Phase 4 — Branch
Run `scripts/start-feature.sh <N> "<short description>"`.
Never work on develop or main.

## Phase 5 — Implement
- Work in small commits, each following the commit convention with (#<N>).
- If you discover the plan was wrong, stop and tell the user rather than
  improvising a different approach.
- Never push. Ask first.

## Phase 6 — Verify and hand back
1. Run the build and tests. Report real output, not a summary.
2. Walk the user through the diff file by file, explaining WHY each
   change exists, not what it does.
3. List anything you did that wasn't in the plan.
4. Report which acceptance criteria are met and which aren't.

## Task types
If the issue is a design task (no implementation), skip phases 4-5.
The deliverable is a written document; still do phases 1-3 and 6.
