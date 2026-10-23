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
- [ ] Rows 1–16 are changed in `static/index.html`. No other wording, sizes or logic change. `drawStatus` uses `status.text` for the green sign.
- [ ] On a 380 px phone the new chip („máš 2/3 !“), the red sign („Vo štvrtok ti chýbajú 3 miesta“, at most 3 lines, no „…“) and the green sign („Všetko máš“) are readable and no longer than before.
- [ ] Rows 17–19 in `proposal.md` and rows 20–26 in `tests/manualne.md` are updated. No other proposal text changes.
- [ ] All Node assertions listed above use the new texts. The regression guard exists, its checker self-test passes, and both scan layers pass.
- [ ] A search of `static/index.html` for `vám`, `vaš`, `máte`, ` ste`, `(vy)` and `nespíte` finds nothing user-facing.
- [ ] No `innerHTML` introduced.
- [ ] `node --test tests/js/` and `uv run pytest -q` pass.

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

## Review round 1
(reviewer appends)

## Review round 2
(reviewer appends)

## Test report
(tester appends)
