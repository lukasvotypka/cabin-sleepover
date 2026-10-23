# T-020: Tykanie everywhere, no plural "vy" forms

- **Phase:** 1 (organizer request, 23. 10. 2026)
- **Depends on:** T-016 (it adds `meadowLabel` with „z vašej partie“. Start only after T-016 is in `done/` and committed.)
- **Size:** S

## Goal
The app is an informal tool for friends. Every user-facing Slovak text must address the user with singular tykanie („máš“, „si“, „ti“, „tvoja“). Some texts from T-013, T-014 and T-016 use the plural 2nd person („máte“, „nie ste“, „vám“, „vašej“, „(vy)“). That plural reads exactly like formal vykanie, so it has to go too. Proposal sections: "Cieľ a kontext" (bullet **Jazyky**: „s tykaním“), "Informácie v scéne", "Mapa".

Organizer's words: „Uprav texty, použi všade tykanie, nikde nie vykanie. Má to byť neformálna aplikácia pre kamarátov.“

## Wording policy (product owner default, organizer may change)
- **Singular "ty" for the user, and the user speaks for the party.** The app already does this in „Kto si?“, „Si: Ivan a Eva“, „Tu sa zapíšeš“ and „Žltý rámik majú miesta tvojej partie“. Texts about my party's places therefore also use the singular: „máš 2/3“, „V sobotu ti chýba 1 miesto“, „nie si tu“, „z tvojej partie“.
- **No plural 2nd person at all.** Do not use vy, vás, vám, vami, váš/vaša/vaše/vašej/…, ste, máte, potrebujete, nespíte, or plural imperatives (-te: „Zadajte“, „Kliknite“, „Vyberte“, „Skúste“). Even in a friendly group sense they read as vykanie, which the brief forbids.
- **Neutral wording where the singular reads badly.** Use the party as a 3rd-person subject („Partia „X“ v sobotu nie je na chate“) or an impersonal form („chýbajú 2 miesta“). The existing neutral texts (the error table, `summaryText`) already do this and stay.
- **Allowed and unchanged:**
  - the 1st person plural in the user's own voice on buttons: „Zapísať nás sem“, „Na všetky naše noci“;
  - the app speaking as "we": „… sme vynechali“, „Túto partiu sme nenašli“;
  - 3rd person about a party: „Toto miesto má Riso a Ben“.
- Keep text length about the same or shorter. The scene boards have fixed widths: the signpost chip has about 48 scene units of text width at size 7, and the red status sign wraps at 14 characters × 3 lines.

## Audit: every occurrence found (23. 10. 2026)
Replace exactly these strings. Line numbers are from the working tree with T-016 applied and may shift. Search by the string.

### `static/index.html`, `<script id="logic">`
| # | Where | Today | New |
| --- | --- | --- | --- |
| 1 | `tallyChipText`, absent (≈ l. 538) | „nie ste tu“ | „nie si tu“ |
| 2 | `tallyChipText`, others (≈ l. 539) | „máte 2/3 !“, „máte 4/3“, „máte 3/3“ | „máš 2/3 !“, „máš 4/3“, „máš 3/3“ |
| 3 | `tallyLabel`, absent (≈ l. 545) | „V túto noc tu nie ste“ | „V túto noc tu nie si“ |
| 4 | `tallyLabel`, under (≈ l. 547) | „Máte 2 miesta, potrebujete 3, chýba 1 miesto“ | „Máš 2 miesta, potrebuješ 3, chýba 1 miesto“ |
| 5 | `tallyLabel`, over and not present (≈ l. 550) | „V túto noc tu nie ste, ale máte 1 miesto“ | „V túto noc tu nie si, ale máš 1 miesto“ |
| 6 | `tallyLabel`, over (≈ l. 551) | „Máte 4 miesta, potrebujete 3, o 1 miesto viac“ | „Máš 4 miesta, potrebuješ 3, o 1 miesto viac“ |
| 7 | `tallyLabel`, ok (≈ l. 553) | „Máte 3 miesta, presne toľko, koľko potrebujete“ | „Máš 3 miesta, presne toľko, koľko potrebuješ“ |
| 8 | `myPartyStatus`, missing (≈ l. 566) | „V sobotu vám chýba 1 miesto“ (`" vám "`) | „V sobotu ti chýba 1 miesto“ (`" ti "`) |
| 9 | `myPartyStatus`, extra (≈ l. 573) | „Máte o 1 miesto viac, než potrebujete“ | „Máš o 1 miesto viac, než potrebuješ“ |
| 10 | `myPartyStatus`, ok (≈ l. 576) | „Všetko máte“ | „Všetko máš“ |
| 11 | `meadowLabel` (≈ l. 697, from T-016) | „Na lúke čaká 1 človek z vašej partie bez postele“ (all counts) | „Na lúke čaká 1 človek z tvojej partie bez postele“ (all counts) |
| 12 | `notPresentText` (≈ l. 807) | „V sobotu nie ste na chate.“ | „V sobotu nie si na chate.“ |
| 13 | `MOVE_TEXTS.not_held` (≈ l. 828) | „Tú noc nespíte na pôvodnom mieste. Prepni noc alebo zvoľ „Všetky noci“.“ | „Tú noc na pôvodnom mieste nespíš. Prepni noc alebo zvoľ „Všetky noci“.“ |
| 14 | `ERROR_TEXTS.slot_taken`, `own === true` (≈ l. 1307) | „Toto miesto už v piatok máte.“ (`"máte."`) | „Toto miesto už v piatok máš.“ (`"máš."`) |

### `static/index.html`, `<script id="app">`
| # | Where | Today | New |
| --- | --- | --- | --- |
| 15 | `drawStatus`, ok branch (≈ l. 2243) | hard-coded „Všetko máte“ | use `status.text` (now „Všetko máš“), so the text lives in one place |
| 16 | `openLegend`, my party's row (≈ l. 2826) | „ (vy)“ | „ (ty)“ (see decision 2) |

Checked and correct already: the code screen („Zadaj kód, ktorý ti poslal organizátor.“), noticeboard lines, `whoText`, the status board aria texts („Ťuknutím vyberieš partiu.“, „Najprv si vyber partiu.“), the bed sheet („Zapísať nás sem“, „Na všetky naše noci“, „Upraviť príchod a odchod“, „Táto posteľ je v túto noc plná.“), `skippedText` („sme vynechali“), `releaseConfirmText`, `moveBarText`, `FREED_TEXTS`, `REASON_TEXTS`, `FIELD_NAMES`, the other `ERROR_TEXTS`, `FALLBACK_ERROR`, „Kto si?“, „Kto je kto“, the party form, the toasts („Uložené.“, „Skopírované.“, „Text je označený, skopíruj ho.“), `summaryText` („Prehľad na poslanie“, „Chýbajú miesta:“, „Tu sa zapíšeš:“), `hiddenSummary`, the bed labels, the loading and boot texts, `<noscript>`, and all `aria-label`s in the HTML.

### `config/chata.yaml`
Nothing to change. Room and bed names have no address form. The comment „lúka, kde čakajú ľudia mojej partie bez postele“ is 1st person and fine.

### `proposal.md`
| # | Section | Today | New |
| --- | --- | --- | --- |
| 17 | "Informácie v scéne", bullet „Tri smerovníky nocí“ | štítok „máte 2/3“ … a „nie ste tu“ | štítok „máš 2/3“ … a „nie si tu“ |
| 18 | "Informácie v scéne", bullet „Tabuľka s partiou a stavom“ | „V sobotu vám chýba 1 miesto“, „Máte o 1 miesto viac, než potrebujete“, „Všetko máte“ | „V sobotu ti chýba 1 miesto“, „Máš o 1 miesto viac, než potrebuješ“, „Všetko máš“ |
| 19 | "Cieľ a kontext", bullet **Jazyky**: append | — | „Tykanie znamená 2. osobu jednotného čísla (máš, si, ti, tvoja partia). Používateľ hovorí za svoju partiu, preto aj texty o partii sú v jednotnom čísle („Si: Ivan a Eva“, „V sobotu ti chýba 1 miesto“). 2. osoba množného čísla (vy, máte, ste, vaša, „Zadajte“) sa nepoužíva, lebo znie ako vykanie. Kde jednotné číslo nesedí, text je neosobný alebo hovorí o partii v 3. osobe. Prvá osoba množného čísla v tlačidlách („Zapísať nás sem“, „Na všetky naše noci“) ostáva.“ |

### `tests/manualne.md`
| # | Item | Today | New |
| --- | --- | --- | --- |
| 20 | §4 „Missing places“ | „V sobotu vám chýba 1 miesto“ | „V sobotu ti chýba 1 miesto“ |
| 21 | §5 „Slovak and informal everywhere“: extend | "uses tykanie and „ “ quotes" | "uses singular tykanie (máš, si, ti, tvoja), never „vy“, „máte“, „ste“, „vaša“ or „-te“ imperatives, and „ “ quotes" |
| 22 | §5 „Tally chips (T-013)“ | `máte X/Y`, `nie ste tu` | `máš X/Y`, `nie si tu` |
| 23 | §5 „Kto je kto (T-014)“ | „(vy)“ | „(ty)“ |
| 24 | §8 „Night signposts (T-013)“ | „Máte 2 miesta, potrebujete 3, chýba 1 miesto“, „V túto noc tu nie ste“ | „Máš 2 miesta, potrebuješ 3, chýba 1 miesto“, „V túto noc tu nie si“ |
| 25 | §8 „Kto je kto (T-014)“ | „(vy)“ | „(ty)“ |
| 26 | §8 „Meadow (T-016)“ | „… z vašej partie bez postele“ | „… z tvojej partie bez postele“ |

### `tests/js/logic.test.mjs`: assertions to update with the code
- `myPartyStatus` tests (≈ l. 200–246): „V sobotu vám chýba 1 miesto“, „Vo štvrtok vám chýbajú 3 miesta“, „Vo štvrtok vám chýba 6 miest“, „V piatok vám chýba 1 miesto“, „Máte o 1 / 2 miesto/a viac, než potrebujete“, „Všetko máte“.
- `tallyChipText` / `tallyLabel` tests (≈ l. 275–308): every `máte …`, `nie ste tu`, „Máte … potrebujete …“, „V túto noc tu nie ste…“.
- `wrapText` test (≈ l. 348): input „V sobotu ti chýba 1 miesto“ → `["V sobotu ti", "chýba 1 miesto"]`.
- `slot_taken` own (≈ l. 381): „Toto miesto už v piatok máš.“
- `notPresentText` (≈ l. 601–602): „V sobotu nie si na chate.“, „Vo štvrtok nie si na chate.“
- `planMove` not held (≈ l. 624): the new `MOVE_TEXTS.not_held`.
- `meadowLabel` (≈ l. 1566–1570): „… z tvojej partie bez postele“.
- Any page-source assertion on „(vy)“ or „Všetko máte“, if present.

## Scope
- `static/index.html`: rows 1–16. Text changes only, plus #15 (use `status.text`). No layout, size or logic changes.
- `tests/js/logic.test.mjs`: update the assertions above and add the regression guard below.
- `proposal.md`: rows 17–19.
- `tests/manualne.md`: rows 20–26.

Out of scope:
- `CLAUDE.md` (the orchestrator keeps it);
- `config/chata.yaml`, the server, English code, comments, logs and tests;
- the history sections of other task files (T-013, T-014, T-016 keep their old wording);
- new texts for phase 2 (T-009 has no Slovak UI strings with plural forms today; when it is built it follows the policy above and the guard).

## Regression guard (new Node test)
Add a test in `tests/js/logic.test.mjs` that fails when a plural/formal 2nd-person form comes back.
- **Checker:** a small helper in the test file (not in `index.html`), `formalForms(text) → [words]`.
  - Tokenize with `/[\p{L}]+/gu` and lowercase.
  - Flag a token if it is in the forbidden set: vy, vás, vám, vami, váš, vaša, vaše, vašej, vašu, vašho, vášho, vašom, vašou, vašim, vašimi, vašich, ste, máte, nemáte, potrebujete, nepotrebujete, spíte, nespíte, chcete, môžete, viete, budete.
  - Also flag any token ending in `-te` (`/te$/`) that is not in an allowlist of Slovak non-verb words: chate, sobote, ceste, (extend when needed, with a comment why).
- **Self-test of the checker:**
  - it flags „Zadajte kód“, „nie ste tu“, „máte 2/3 !“, „z vašej partie“, „(vy)“, „Kliknite sem“;
  - it does not flag „V sobotu nie si na chate.“, „Zapísať nás sem“, „Na všetky naše noci“, „sme vynechali“, „v sobote“.
- **What it scans (both layers):**
  1. *Text producers.* Run every Slovak text function and table of the logic script with inputs that hit each branch, and assert `formalForms(...)` is empty:
     - `tallyChipText` and `tallyLabel` for all kinds (with absent and not present);
     - `myPartyStatus` for none, missing, extra and ok;
     - `meadowLabel` for 1, 2 and 5;
     - `notPresentText`, `skippedText`, `releaseConfirmText`, `moveBarText`, `whoText`, `assignLabel`;
     - all values of `NOTICE_LINES`, `MOVE_TEXTS`, `FREED_TEXTS`, `REASON_TEXTS`, `FIELD_NAMES`;
     - `errorText` for every key of `ERROR_TEXTS`, with and without params, including `slot_taken` with `own: true`;
     - `FALLBACK_ERROR`, `summaryText` and `hiddenSummary` on a fixture state.
  2. *Page source.* Read `static/index.html` and drop the `<style>` block. Then take the double-quoted string literals of both scripts, the HTML text nodes, and the `aria-label` / `placeholder` / `title` attribute values. Of those, keep the ones that contain a Slovak letter (`/[áäčďéíľĺňóôŕšťúýž„“]/i`) or a word from the forbidden set. Assert `formalForms` is empty for each and report file text and word on failure. This layer catches app-script literals such as „(vy)“ and the hard-coded status text.
- The guard must pass after rows 1–16 and must fail if any single row is reverted (check this by hand once and note it in the dev log).

## Acceptance criteria
- [x] Rows 1–16 are changed in `static/index.html`. No other wording, sizes or logic change. `drawStatus` uses `status.text` for the green sign.
- [ ] On a 380 px phone the new chip („máš 2/3 !“), the red sign („Vo štvrtok ti chýbajú 3 miesta“, at most 3 lines, no „…“) and the green sign („Všetko máš“) are readable and no longer than before. (not checked on a real phone: verified by `wrapText` only, see Dev log)
- [x] Rows 17–19 in `proposal.md` and rows 20–26 in `tests/manualne.md` are updated. No other proposal text changes.
- [x] All Node assertions listed above use the new texts. The regression guard exists, its checker self-test passes, and both scan layers pass.
- [x] A search of `static/index.html` for `vám`, `vaš`, `máte`, ` ste`, `(vy)` and `nespíte` finds nothing user-facing.
- [x] No `innerHTML` introduced.
- [x] `node --test tests/js/` and `uv run pytest -q` pass.

## Notes for developer
- **Order:** T-016 adds `meadowLabel` and must be in `done/` and committed first. T-017 and T-019 change the same files and come after this task (their `Depends on` lists T-020 for build order).
- Pure text change: keep function names, signatures and return shapes. The `kind` values and `text` fields of `myPartyStatus` keep their structure.
- `missingVerb`, `pluralPlaces` and the plural rules stay as they are. Only the pronoun and the verb person change.
- If a new text does not fit its board on a 380 px phone, note it in the dev log for the organizer. Do not resize boards.
- Open decisions in `proposal.md` are not involved. The policy, the singular for the party, „(ty)“ and the guard design are product-owner defaults for the organizer to confirm (see the decisions below).

## Decisions for the organizer (defaults used)
1. **Singular for the party.** The user is addressed as one person even when the text is about the whole party („V sobotu ti chýba 1 miesto“, „máš 2/3“). Alternative: a neutral 3rd person („V sobotu partii chýba 1 miesto“, „partia 2/3“). It is longer and the chip would get tight.
2. **Marking my party in „Kto je kto“:** „(ty)“. Alternative: „(tvoja partia)“.
3. **1st person plural stays** on the buttons („Zapísať nás sem“, „Na všetky naše noci“) and in the app's "we" („sme vynechali“). It is not vykanie.

---
## Dev log
(developer appends: what was done, files touched, how to run the tests)
**Done (developer, 23. 10. 2026).**
- `static/index.html`: rows 1-16 replaced exactly as in the audit (text only). Row 15: `drawStatus` green sign now draws `status.text` (the "Všetko máš" of `myPartyStatus`), one place for the text. Row 16: „(ty)“.
- `tests/js/logic.test.mjs`: assertions of rows listed in the task updated (`myPartyStatus`, `tallyChipText`/`tallyLabel`, `wrapText` -> `["V sobotu ti", "chýba 1 miesto"]`, `slot_taken` own, `notPresentText`, `planMove` not_held, `meadowLabel`). Added the guard: helper `formalForms` (forbidden set + `-te` rule), 2 checker self-tests, "text producers" test (>150 texts from all functions/tables, every `ERROR_TEXTS` code with and without params, `slot_taken` own, `summaryText`, `hiddenSummary`) and "page source" test (string literals of both scripts with comments skipped, markup text nodes, `aria-label`/`placeholder`/`title`/`alt`, `<style>` dropped; keeps strings with a Slovak letter or a forbidden word, asserts >100 scanned).
- `proposal.md`: rows 17-19. `tests/manualne.md`: rows 20-26.
- Allowlist of the `-te` rule: `chate`, `sobote`, `ceste` (from the task) plus `mieste` (locative of "miesto", found in `MOVE_TEXTS.not_held`). Commented in the test.
- Hand check of the guard: reverted each of the 16 `index.html` rows one by one on a copy; every single revert made at least one guard test fail (rows 1-14 fail both the producers and page-source layers, rows 15 and 16 only the page-source layer). File restored afterwards.
- 380 px fit: the chip „máš 2/3 !“ is shorter than „máte 2/3 !“. `wrapText(14, 3)` gives „Vo štvrtok ti“ / „chýbajú 3“ / „miesta“ (3 lines, no ellipsis) and „V sobotu ti“ / „chýba 1 miesto“. „Všetko máš“ is shorter than „Všetko máte“. Not looked at on a real phone.
- Search of `static/index.html` for `vám|vaš|máte|\bste\b|\(vy\)|nespíte|potrebujete` finds nothing. The remaining hits in `proposal.md` and `tests/manualne.md` are the policy sentences that name the forbidden forms. No `innerHTML` added.
- Tests: `node --test tests/js/` -> 145 pass, 0 fail. `uv run pytest -q` -> 382 passed. No server started.
- Note: git shows `tasks/todo/T-016...` and `tasks/todo/T-020...` as deleted (task file moves), not touched T-017/T-019.

## Review round 1
(reviewer appends)
**Reviewer, 23. 10. 2026.** Full pass over the diff of `static/index.html`, `tests/js/logic.test.mjs`, `proposal.md` and `tests/manualne.md`.

Checks run by the reviewer:
- `node --test tests/js/` → 145 pass, 0 fail. `uv run pytest -q` → 382 passed.
- **Independent search (not only the audit table).** I tokenized `static/index.html`, `config/chata.yaml`, `config/app.yaml`, `tests/manualne.md`, `README.md` and `proposal.md`, then flagged the whole forbidden set plus every `-te` word on lines with Slovak text. The only plural forms left are the two policy sentences that name them (proposal "Jazyky", manualne §5). Every other `-te` hit is a locative or adverb (štarte, reštarte, návrate, texte, gite, audite, ešte, chate, sobote) or English. `tasks/todo/` (T-009, T-017, T-019) has no plural UI strings either.
- **Grammar** of all 16 new strings: correct singular forms, with case and number agreement intact („Vo štvrtok ti chýbajú 3 miesta“, „ti chýba 6 miest“, „Máš 0 miest, potrebuješ 2, chýbajú 2 miesta“, „Máš o 1 miesto viac, než potrebuješ“, „Toto miesto už (v piatok) máš.“, „Tú noc na pôvodnom mieste nespíš.“, „z tvojej partie“, „(ty)“). `missingVerb` and `pluralPlaces` are unchanged.
- **The guard really catches regressions (mutation test on a copy in /tmp).** I reverted each of rows 1–16 one at a time. Every revert fails the guard: rows 1–14 fail both layers, rows 15–16 fail the page-source layer. Plural strings added as a single-quoted literal, a template literal, a markup `<p>` text node, an `aria-label` and the `<noscript>` text with a diacritic are also caught. The checker self-tests cover the cases the task asks for.
- **innerHTML:** 0 occurrences at HEAD and 0 now. None added.
- **Row 15:** `drawStatus` green branch now draws `status.text` and keeps `maxWidth`. Its `aria-label` uses the same value, so the text has one source.
- **380 px in headless Chrome** (CDP, 380×800 @2x, own servers on ports 8077 and 8078, HEAD page against the new page, same data). Shortage: chips „máš 0/3 !“, „máš 4/3“, „máš 3/3“, and the red sign „Vo štvrtok ti / chýbajú 3 / miesta“ on 3 lines with no „…“. Excess: amber „Máš o 1 miesto / viac, než / potrebuješ“. Absent: „nie si tu“ chip and the green „Všetko máš“. All fit inside their boards and are no wider than the old „máte …“ / „Všetko máte“. The 2nd acceptance criterion is therefore met in headless Chrome at 380 px. A check on a real phone is still for the tester or organizer.
- Scope: only rows 17–19 changed in `proposal.md` (3 lines) and rows 20–26 in `manualne.md`. No logic, size or layout change in the page.

**Blocker:** none.

**Suggestion:**
- `tests/js/logic.test.mjs`, page-source layer (`scanned` filter): a string with no diacritics and no word from the forbidden set is skipped. So a plain-ASCII plural imperative passes. Example: changing the `<noscript>` text to „Zapnite JavaScript.“ or adding a literal „Kliknite sem“ keeps the guard green (I tested both). This follows the filter the task specified, so it is not a blocker. A cheap hardening would be to run `formalForms` on *all* markup text nodes and `aria-label`/`placeholder`/`title` values (they are user-facing by definition) and keep the Slovak-letter filter only for script literals.

**Nit:**
- The literal tokenizer in the page-source test ignores JS regex literals. A future regex containing a quote character (e.g. `/"/`) could desync it. Today it reads more than 100 literals and catches every mutation above, so this is fine for now.

Round 2 skipped, no blockers.

Verdict: APPROVED

## Review round 2
(reviewer appends)

## Test report
**Tester (Haiku 5.5), 23. 10. 2026.** Verdict: PASS. Moved to `done/`. The real-phone check stays a manual item (`tests/manualne.md` §5).

### Commands and results
- `node --test tests/js/` → 145 pass, 0 fail (run before and after my guard change).
- `uv run pytest -q` → 382 passed.
- Served page: `uv run python /tmp/t020-check/serve.py` (temp `data` dir `/tmp/t020-check/data`, port 8391, test secrets set in the environment, the repo `.env` not used). `GET /api/health` → 200. `GET /` contains „Všetko máš“, „nie si tu“ and „tvojej partie“. `GET /data/chata-data.yaml`, `/data/audit.yaml`, `/config/chata.yaml`, `/.env` → 404. The real `data/` was not touched. The server was stopped afterwards.
- Real logic block run in `node:vm` with my own fixtures (`/tmp/t020-check/check.mjs`): `tallyChipText` → „nie si tu“, „máš 2/3 !“, „máš 2/3“; `tallyLabel` → „V túto noc tu nie si“, „Máš 2 miesta, potrebuješ 3, chýba 1 miesto“, „Máš 2 miesta, potrebuješ 3, o 1 miesto viac“, „Máš 2 miesta, presne toľko, koľko potrebuješ“, „V túto noc tu nie si, ale máš 1 miesto“; `meadowLabel` 1/2/4/5/7 → all „tvojej“; `notPresentText` → „V sobotu nie si na chate.“; `MOVE_TEXTS.not_held` → „Tú noc na pôvodnom mieste nespíš. …“; `slot_taken` own → „Toto miesto už v piatok máš.“. Grammar checked by hand, agreement is correct.
- `wrapText(text, 14, 3)` (the red sign width): „Vo štvrtok ti chýbajú 3 miesta“ → „Vo štvrtok ti / chýbajú 3 / miesta“ (3 lines, no „…“); „V sobotu ti chýba 1 miesto“ → 2 lines; „Všetko máš“ → 1 line.
- `git diff -- static/index.html`: 14 hunks, all in the audit rows 1–16 (row 15 is `drawStatus` using `status.text`, the ok branch only runs for `kind === "ok"`). No other change.
- Single-hunk revert check (each of the 14 hunks reverted alone in a copy under `/tmp`, then `node --test`): every revert fails the guard (rows 1–14: 3 to 5 failing tests; rows 15–16: 1 failing test). Clean page: pass.
- Search of `index.html` for `vy|vás|vám|vami|váš*|máte|ste|potrebujete|nespíte` → 0 hits. `(vy)` → 0. `innerHTML` → 0 (also 0 at HEAD). Hits in `proposal.md` and `tests/manualne.md` are policy sentences that name the forbidden forms, or English text.

### Gaps found in the guard, fixed by the tester (tests only, no app code)
The guard passed two plausible regressions. Reproduced on copies in `/tmp`:
1. **Missing form.** „vaši“ (plural nominative, also „vaším“, „vaší“, „vášmu“) was not in `FORMAL_WORDS`. A logic-literal change to „… koľko potrebuješ; vaši partia“ kept the guard's scan tests green (only the exact-text test failed). Fix: the four forms added to `FORMAL_WORDS`, with a self-test line.
2. **ASCII-only text skipped.** The page-source layer dropped strings without a Slovak letter or a forbidden word. `<noscript>` text changed to „Zapnite JavaScript.“ passed. Fix: markup text nodes and `aria-label`/`placeholder`/`title`/`alt` values are scanned unconditionally (they are user-facing by definition). For script literals the filter keeps a Slovak letter, a forbidden word, or a sentence (capital letter and a space), so ASCII prose in code is caught too. Code strings such as the class name „note“ are not caught by the `-te` rule, so they are not flagged.
After the fix all four mutants fail the guard (vaši in a producer, ASCII noscript, one-word ASCII literal in a producer, „vaše“ in markup), and the clean page passes (145/145).

Files changed by the tester: `tests/js/logic.test.mjs` (guard hardening above), `tests/manualne.md` (§5 readability item now names the green „Všetko máš“ sign and the red sign's wrap check).

### Acceptance criteria
| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Rows 1–16 changed, no other wording, size or logic change; `drawStatus` uses `status.text` | PASS | diff review, 14 hunks, all audit rows |
| 2 | On 380 px the chip, red sign and green sign are readable and no longer than before | PASS for the checkable part; on-device readability is manual | `wrapText` run, the chip and „Všetko máš“ are shorter than the old text. Real phone: `tests/manualne.md` §5 |
| 3 | Rows 17–19 in `proposal.md`, rows 20–26 in `tests/manualne.md` | PASS | grep of the changed lines; proposal line 19 has the Jazyky addition |
| 4 | Node assertions use the new texts; guard exists; self-test passes; both scan layers pass | PASS | 145/145; guard reverts all caught; tester hardening above |
| 5 | Search of `static/index.html` for `vám`, `vaš`, `máte`, ` ste`, `(vy)`, `nespíte` finds nothing user-facing | PASS | 0 hits |
| 6 | No `innerHTML` introduced | PASS | 0 at HEAD and now |
| 7 | `node --test tests/js/` and `uv run pytest -q` pass | PASS | 145 and 382 |

### Extra scenarios tried
- Served page over HTTP with the new strings, and data and config paths not reachable (404).
- Grammar of every changed string (singular agreement, „ti chýba“, „z tvojej partie“, „máš 0 miest“).
- Guard sensitivity: 14 single-hunk reverts, 4 hand-made mutants (see above).

### Residual, non-blocking
- A single-word ASCII plural imperative in a script string that is not in a text producer (for example a bare `"Vyberte"` in a click handler) is still not flagged. The guard catches it only when it reaches a text producer or a sentence.
- Real-device checks (iPhone Safari, Android Chrome, WhatsApp in-app browser) for the 380 px fit are manual, in `tests/manualne.md`.
- Organizer defaults from the task still need confirmation: singular for the party, „(ty)“, and 1st person plural kept on buttons.

No bug reports: no acceptance criterion failed.
