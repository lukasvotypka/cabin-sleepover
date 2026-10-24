# T-030: Drop the word „partia“ from the page texts

- **Phase:** 1
- **Depends on:** none
- **Size:** S

## Goal
Organizer feedback (24. 10. 2026): people did not understand „partia“. In Slovak a „partia“ is the whole group of friends going to the cabin, but the page uses it for one sign-up unit (one person, a couple or a family). Remove the word (and „partie“, „partiu“, „partii“, …) from every Slovak text on the page. Ask „Kto si?“ instead and say „vy“ where more people are meant. How many people come is already clear from the form (adults, kids). This is a text-only change: code identifiers, API paths (`/api/parties`), data and the write path stay as they are.

## Scope
- Slovak strings in `static/js/` (`app-form.js`, `app-sheet.js`, `app-draw.js`, `logic-model.js`, `logic-beds.js`, `logic-errors.js`, `logic-summary.js`) and `static/index.html` if it has any. This includes `aria-label`s, button labels, toasts and the screen-reader summary.
- Node tests in `tests/js/` and any pytest that asserts these strings.
- `proposal.md`: one short note that the UI never says „partia“ (the internal term stays `party`).

## Text decisions (organizer-approved)
Address one person („Kto si?“, tykanie). Use „vy“/„z vás“ for several people.

| Old | New |
| --- | --- |
| Nová partia / Upraviť partiu | Pridať sa / Upraviť „<meno>“ |
| Meno partie | Meno, with the hint „napr. Jano, Jano a Zuzka, Novákovci“ |
| Notice steps 1–2: „Pridaj svoju partiu.“ „Vyber, za ktorú partiu si.“ | „1. Pridaj sa (koľko vás príde).“ „2. Vyber, kto si.“ (steps 3–4 unchanged) |
| Najprv si vyber partiu | Najprv vyber, kto si |
| Zmeniť partiu / Vybrať moju partiu | Som niekto iný / Vybrať, kto som |
| Pridať partiu | Pridať sa |
| Zapísať nás sem ako partiu „X“ (n miesta) | Zapísať sem „X“ (n miesta) |
| Partia „X“ už existuje. Vymysli iné meno. | Meno „X“ už niekto má. Skús iné. |
| Farba postavičky na mape patrí partii. | Každý má na mape svoju farbu. |
| Table header „Partia“, legend heading „Partie po nociach“ | „Kto“, „Kto kde spí po nociach“ |
| Na lúke N z tvojej partie bez postele | Na lúke N z vás bez postele |
| neznáma partia | neznámy |

For every other string, rephrase in the same spirit (e.g. „Tvoja partia v túto noc …“ → „Ty a tvoji v túto noc …“ or „Vy v túto noc …“, „Túto partiu sme nenašli“ → „Toto meno sme nenašli. Vyber znova, kto si.“, „Zatiaľ tu nikto nie je. Pridaj prvú partiu.“ → „Zatiaľ tu nikto nie je. Pridaj sa ako prvý.“). Keep typographic quotes „ “ and check that the new texts still fit the scene boards (wrap widths in `app-draw.js`).

## Acceptance criteria
- [x] `grep -rniE "parti[ae]|partiu|partii|partií" static/` finds no Slovak user-facing text. English comments and identifiers may stay.
- [x] The texts in the table above are used exactly. The other rephrased texts read naturally and use tykanie.
- [x] The form name field shows the hint with all three examples (single person, couple, family).
- [ ] The scene texts (noticeboard, status board, party table header) still fit their boards at 380 px with no overflow or clipping.
- [x] No change to API, data, identifiers or the write path. No `innerHTML` added.
- [x] `node --test tests/js/` and `uv run pytest` pass, with the assertions updated to the new texts.

## Notes for developer
- Error texts live only in `static/js/logic-errors.js` (lookup by `code`). The server sends no Slovak text, so nothing changes in `app/`.

---
## Dev log
- Replaced every Slovak „partia“ text per the table; rephrased others (not_present: „Nikto z vás nie je v túto noc na chate.“, enough-already: „Ak zapisuješ niekoho iného, ťukni na „Som niekto iný“.“, form title „Upraviť „X““, toast „Pridané: „X“.“). Name field has the hint with all three examples.
- Files: static/js/{app-form,app-sheet,app-draw,logic-model,logic-beds,logic-errors}.js, tests/js/logic.test.mjs, proposal.md (note).
- Test guard (T-020) forbade „vy“/„vás“; removed those two from FORMAL_WORDS since the organizer now wants them. Notice step 1 is 33 chars, so the length cap in the NOTICE_LINES test went 30 -> 34; addText squeezes via textLength if wider than the board (not checked visually at 380 px).
- Ran: `PATH=/opt/homebrew/bin:$PATH node --test tests/js/` (207 pass), `uv run pytest -q` (396 pass).
- Remaining grep hits are English identifiers/comments only. Visual fit at 380 px not verified in a browser.

## Review round 1
Tests run by reviewer: `node --test tests/js/` 207 pass, `uv run pytest -q` 396 pass. All 19 scripts in `static/js/` are listed in `index.html` with `?v=__ASSET_VERSION__`. Grep: the only Slovak hit left is the English-context comment in `app-boot.js:158` (*moja partia*), which is fine. No API, data, identifier or `innerHTML` changes. The table texts match exactly, and the name hint is present. Fit check (estimate): notice step 1 is about 33 chars at 7.5 units, about 135 units against `maxWidth` 172, so it fits, and `addText` squeezes anything wider. „Kto“ and „Najprv vyber, kto si“ (wrap 19 gives „Najprv vyber, kto“ / „si“) fit too.

**Blocker**
- `static/js/app-draw.js:377` (status board aria-label): `"Najprv vyber, kto si. Ťuknutím ju vyberieš."`. The „ju“ used to point at „partiu“ and now points at nothing, so screen readers read a broken sentence (fails AC 2, "read naturally"). Fix: `"Najprv vyber, kto si. Ťuknutím to vyberieš."`, or reuse the top-row wording `"… Ťuknutím vyberieš, kto si."` (shorten as needed so it does not repeat).

**Suggestion**
- `proposal.md` line 19: the new note sits in the same paragraph that still says „tvoja partia“, „texty o partii“ and that „vy“ is never used. Reword that paragraph so the new rule ("vy/z vás" allowed for several people, no „partia“) does not contradict the older lines.
- `static/js/logic-errors.js` `FIELD_NAMES.party_id: "kto"` gives „Skontroluj pole „kto“.“, which reads oddly. Something like „výber, kto si“ would read better. The path is rare.

Verdict: CHANGES REQUESTED

## Review round 2
Tests run by reviewer: `node --test tests/js/` 207 pass, `uv run pytest -q` 396 pass.
- Round-1 blocker fixed: `app-draw.js:377` now reads „Najprv vyber, kto si. Ťuknutím to vyberieš.“
- Both suggestions done: the `proposal.md` rules paragraph no longer contradicts the new rule, and `FIELD_NAMES.party_id` is now „výber, kto si“.
- Fresh pass over the fix diff found no new issues. The grep finds no Slovak „partia“ text in `static/`. The open AC (fit at 380 px) is a visual check, so it is left to the tester. The estimate from round 1 still holds.

Verdict: APPROVED

## Test report

## Dev log (fixes for review round 1)
- Blocker fixed: `app-draw.js` status board aria-label now „Najprv vyber, kto si. Ťuknutím to vyberieš.“
- Suggestion 1 fixed: `proposal.md` rules paragraph reworded (no „tvoja partia“/„texty o partii“, „vy“ / „z vás“ allowed for several people, formal address still banned).
- Suggestion 2 fixed: `logic-errors.js` `FIELD_NAMES.party_id` is „výber, kto si“ (gives „Skontroluj pole „výber, kto si“.“).
- Tests: `node --test tests/js/` 207 pass, `uv run pytest -q` 396 pass.
- Unticked AC (fit at 380 px) is still only estimated, not checked in a browser.

- Tester (Haiku 5.5): tests run on the working tree (no commit).
  - `PATH=/opt/homebrew/bin:$PATH node --test tests/js/`: 207 pass, 0 fail.
  - `uv run pytest -q`: 396 passed.
  - `grep -rniE "parti[ae]|partiu|partii|partií" static/`: only English comments and identifiers (`party`, `parties`, `/api/parties`, `moja partia` in a code comment in `app-boot.js:158`). No Slovak UI text.
  - Real browser at 380x760 (Chrome for Testing via Playwright 1.49 from another project, DPR 2, reduced motion, temporary server on 127.0.0.1:8731 with test secrets and a temp data dir, two test parties „Jano“ and „Novákovci z Trnavy a Kováčovci“). No page errors. No horizontal scroll (scrollWidth 380 = innerWidth 380). Screenshots looked at for both the expanded noticeboard and the collapsed table view.

| # | Acceptance criterion | Result |
| --- | --- | --- |
| 1 | No Slovak „partia“ in `static/` | pass (grep above) |
| 2 | Table texts used exactly; others natural, tykanie | pass (each table string found in its script; the notice shows „1. Pridaj sa (koľko vás príde).“, „2. Vyber, kto si.“; the status board reads „Najprv vyber, kto si“ / „Ťuknutím to vyberieš.“) |
| 3 | Name field hint with all three examples | pass (`app-form.js` contains „napr. Jano, Jano a Zuzka, Novákovci“) |
| 4 | Scene texts fit their boards at 380 px, no overflow or clipping | pass. Measured in the browser: notice steps 1–4 (step 1 ends at x 328 on a 380 board, inside the board), the „Kto“ header, „Najprv vyber, kto / si“ (two lines inside the board), the party table rows, the „Chata“ title, the signposts. Nothing outside the viewBox. Two small notes, not T-030 regressions: `Kto si? Ťukni sem` (unchanged string, `logic-model.js:354`) and `Chodbička` / `Letná kuchynka` / `31. 10./1. 11.` are squeezed by `textLength` (about 4–10 % compression) because they are slightly wider than their boards; they read fine in the screenshot. The status board wraps „si“ alone onto the second line, which is cosmetic. |
| 5 | No change to API, data, identifiers, write path, no `innerHTML` added | pass (diff touches only text strings and `static/js`, `tests/`, `proposal.md`; no `innerHTML` in the changed lines) |
| 6 | `node --test tests/js/` and `uv run pytest` pass | pass (207 and 396) |

Extra scenarios: `/api/health` ok, join with group code ok, `/api/state` ok, `POST /api/parties` ok (long name accepted). Regressions: the full suite includes all `tasks/done/` tests, all pass.

Manual: `tests/manual.md` updated (stale „Vybrať moju partiu“ and „Upraviť partiu“ replaced with the new texts) and a T-030 item added for iPhone Safari and Android Chrome. Not verified here: a real screen reader and a real phone.

Outstanding observation for the developer (not blocking): `proposal.md:37` still says „formulár partie“ in the file table, and `proposal.md:11` says „partií“ in the brief. Both are docs and outside the UI rule, so I left them.

Verdict: PASS, moved to done.
