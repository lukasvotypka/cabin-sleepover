# T-099: „Kto si?“: no lock at protected parties, last seen as for everyone

- **Phase:** 1
- **Depends on:** T-096
- **Size:** S

## Goal
Organizer's decision of 26. 10. 2026: the lock in the „Kto si?“ list adds no value. A protected party's row looks like any other and shows its last seen time. Tapping it still opens „Prihlás sa“ when the device is not verified.

## Scope
`static/js/app-sheet.js`, `static/index.html` (drop `.party-row .lock`), `proposal.md`, `tests/manual.md`.

## Acceptance criteria
- [x] No lock in the list; the row has the swatch, name, last seen and ✓ like other rows; its screen-reader label is name + last seen.
- [x] Tapping an unverified protected party still opens the login panel.
- [x] `node --test tests/js/` (349) and `uv run pytest` (728) pass.

---
## Dev log
Small UI change done directly by the orchestrator at the organizer's request; no review or test round. Checked on the trial server.
