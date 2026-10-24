# Task board

The folder a task file sits in is its status. Move a task with `mv`, never copy it.

```
tasks/todo/          TODO         ready to be picked up (analyst creates)
tasks/in-progress/   IN-PROGRESS  developer is implementing or fixing
tasks/review/        REVIEW       waiting for reviewer (round 1 or round 2)
tasks/testing/       TESTING      review approved, waiting for tester
tasks/done/          DONE         tested and accepted
```

## Flow

```
todo → in-progress → review (round 1) ─ changes requested ─→ in-progress → review (round 2)
                                      └─ approved ───────────────────────────────┐
                                                        round 2 approved ─────────┤
                                                        round 2 blockers → in-progress
                                                                                  ↓
                                                  testing ─ pass ─→ done
                                                     └─ fail ─→ in-progress → review (re-check) → testing
```

- **Review** has exactly 2 rounds. Round 1 is a full review. Round 2 verifies the fixes and does a final pass. After round 2 the reviewer either approves (→ `testing`) or sends the task back to `in-progress` with the remaining blockers, and the orchestrator reports it to the user.
- **Testing** failure sends the task back to `in-progress` with a bug report. After the fix it returns to `review`, where the reviewer does a short re-check (it does not count as a new round pair), then on to `testing`.
- A task may start only when every task in its `Depends on` list is in `done/`.

## Task file format

File name: `T-001-short-slug.md` (3-digit number, ordered by intended build order).

```markdown
# T-001: Title

- **Phase:** 1 | 2
- **Depends on:** T-000, … (or "none")
- **Size:** S | M | L (L means it should probably be split)

## Goal
What and why, in 1–3 sentences. Cite the proposal section ("Dáta v YAML", "HTTP API", …).

## Scope
Files to create or change.

## Acceptance criteria
- [ ] Concrete, checkable items. Include the tests that must exist.

## Notes for developer
Pitfalls and decisions already made. Open decisions use the default from proposal.md.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
```

Each agent appends only to its own section, so the history stays in the file.

## Keeping tasks cheap

- A task file is short (aim for under ~60 lines before the logs). Cite proposal sections by name instead of copying their text.
- Prefer size S or M. Split an L task, because every send-back costs the developer and the reviewer a full read again.
- Acceptance criteria must be concrete and testable, so review and testing do not need to guess.
