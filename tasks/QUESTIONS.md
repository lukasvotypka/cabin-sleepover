# Open questions for the organizer

**All questions answered by the organizer on 21. 10. 2026.** Decisions: Q3 and Q4 changed (see below, `proposal.md` updated), Q9 status rect enlarged, Q11 positions accepted and added to `proposal.md`, all other defaults accepted. Q13, which came out of the Q3 answer, is answered as well: `assign-stay` takes `slots[]`. **Q14 (23. 10. 2026) is open**; T-023 uses its defaults until the organizer answers.

Written by the analyst while splitting `proposal.md` into tasks. Each question has a **default** that the tasks use until the organizer answers. When a question is answered, update the affected tasks (listed per question) and mark the question answered here.

The open decisions listed in `proposal.md` under „Otvorené rozhodnutia“ are not repeated here. Tasks use their stated defaults.

Q1 (missing `chata-prehlad.html`) and Q7 (admin UI) were resolved by the proposal revision of 21. 10. 2026 and removed. The palette, colors and fonts are now in „Vzhľad“, and the admin panel behind a key icon is now specified. The numbers of the other questions are kept so that task references stay valid.

## Q2. Which figures on the map are kids?

The proposal says kids are smaller figures. But `sleeping` only stores `night → slot → party_id`, so it does not record which slot holds a kid.

- **Default:** for each party and night, take its slots in layout order (rooms, then beds, then slots as in `chata.yaml`). The first `adults` slots get adult figures and the rest get kid figures. Kids who sleep with their parents (`kids_in_parents_bed`) get no figure.
- Affects: T-006.
- **Answer:** default accepted.

## Q3. How many slots does one tap fill?

The API writes one slot per call (`/api/assign`, `/api/assign-stay`). A party of 2 who taps a double bed might expect both places to be filled.

- **Default:** one tap fills one slot, the first free slot of the bed in the selected night. After success, if the party still needs places and the bed still has a free slot, the same button stays available for a second tap. The red sign in the scene shows what is still missing.
- Affects: T-006.
- **Answer (changed):** one tap on a bed takes as many free slots in that bed as the party still needs that night (at least one). `/api/assign` takes `{night, slots[], party_id}` and is all-or-nothing, like `/api/move`. Affects T-001, T-004, T-006.

## Q4. Assigning more slots than the party needs

The proposal does not say whether `assign` should refuse when a party already has `adults + kids − kids_in_parents_bed` slots that night. The warnings it specifies are only about **missing** places.

- **Default:** the server does not refuse, and the page shows no warning for extra places.
- Affects: T-001, T-005.
- **Answer (changed):** the server still does not refuse, but the status board shows a soft amber note such as „Máte o 1 miesto viac, než potrebujete“ when a party holds more slots than it needs on a night. This is a pure page function with Node tests. Affects T-005.

## Q5. `assign-stay` when every night is taken, and `clear` on a free slot

- **Default `assign-stay`:** it writes the nights where the slot is free and lists the taken nights in `skipped`. If nothing could be written (every night taken), it returns `409 slot_taken` and does not write, back up or bump `version`.
- **Default `clear`:** clearing a slot that is already free returns `200` with the current state and does not write (no backup, no audit, no version bump). This keeps two people clearing the same slot from seeing an error.
- Affects: T-001, T-004.
- **Answer:** default accepted.

## Q6. Errors without a valid cookie, and how the page knows the role

The error codes are fixed, but the proposal does not say which one a missing or expired group cookie returns. It also does not say how the page knows after a reload that it should show the admin key icon, since the cookie is HttpOnly and `state` has no role field.

- **Default:** a missing or invalid group cookie returns `401 bad_code` with no `state` in the body, and the page then shows the code screen. A missing admin cookie on an admin endpoint returns `403 forbidden`. `POST /api/join` with the admin code sets **both** cookies (group and admin) and returns `role: "admin"`. The page stores the role in `localStorage` and hides the key icon when an admin call returns `forbidden` (the admin cookie lasts only 12 h).
- Affects: T-003, T-005, T-007.
- **Answer:** default accepted.

## Q8. Pure page functions versus „one file“

The proposal wants the whole frontend in one `static/index.html` and also wants the page logic tested in Node without a browser.

- **Default:** keep one file. The pure functions sit in their own `<script id="logic">` block that does not touch the DOM. The Node tests read `static/index.html`, extract that block and run it in `node:vm`. A separate `static/logic.js` would be simpler. That needs the organizer's OK.
- Affects: T-005, T-006, T-007.
- **Answer:** default accepted (one file, `<script id="logic">` extracted by the Node tests).

## Q9. 44 px touch targets inside the scene

The proposal requires every control (beds, signposts, icons, buttons) to be at least 44 px on screen. The scene is 380 units wide and fills the screen width, so 1 unit is about 1 px only on a 380 px screen. Several sizes in the `chata.yaml` example are at or below that limit:

- **Signposts:** the `nights` rect is 44 units tall. That is exactly 44 px at 380 px width and less on narrower phones (about 43 px on a 375 px iPhone, about 42 px at 360 px).
- **Status board:** the `status` rect is 94×70 units, but it holds two separate tap targets („Si: …“ and the red warning sign). Two 44 px targets do not fit in 70 units.
- **Beds:** the small beds (lehátko 20×36, posteľ 24×34) are only about 20 px wide on screen.

- **Default:** keep the rects from the proposal. Each tap target gets the largest transparent hit area that does not overlap a neighbour. The signposts extend into the grass gaps above and below them (y 54–60 and 104–112). Panel buttons are a real 44 px. The hidden screen-reader summary and keyboard focus are the alternative for beds.
- **Suggestion for the organizer:** if 44 px is a hard rule, enlarge the rects in `chata.yaml`, for example `status: [278, 322, 94, 88]` (two 44-unit rows, still clear of the house and the path). Only the config changes, not the code.
- Affects: T-001, T-005, T-006.
- **Answer:** default hit areas accepted, plus `status: [278, 322, 94, 88]` (two 44-unit rows) in `chata.yaml`. Pinch-zoom must stay enabled (no `user-scalable=no`).

## Q10. Smaller points (defaults only, no answer needed unless you disagree)

- **Shrinking a party without shortening the stay** (fewer adults or kids): no slots are freed automatically. Only shortening the stay frees slots (`freed`).
- **`kids_in_parents_bed` larger than `kids`:** rejected as `invalid`. Otherwise the needed count could go negative.
- **Rate limit without `X-Client-Id`:** the write limit falls back to the client IP.
- **Audit `source`:** `admin` for admin endpoints and for any write that carries the admin cookie. Otherwise `formular` for party endpoints and `mapa` for slot actions.
- **Room labels on the map** come from `name` in `chata.yaml`. „Chodbička“ may not fit in the 54-unit corridor in a monospace font. Shortening it in `chata.yaml` fixes that without a code change.
- **`POST /api/parties`** also returns the created `party` next to `state`, so the page can set it as *moja partia*.
- Affects: T-001, T-004, T-006, T-007.
- **Answer:** defaults accepted.

## Q11. Where do the locked-signup sign, the letter icon and the key icon go?

„Informácie v scéne“ says the positions of all scene elements are in `map.scene`. The `chata.yaml` example only has rects for `title`, `nights`, `notice` and `status`. It has none for the „Zápis je zatvorený“ sign, the letter icon („Prehľad na poslanie“) or the admin key icon. The status rect is too small to hold them as 44 px targets as well (Q9).

- **Default:** add three rects to `map.scene` in the free grass so that no geometry is hardcoded:
  - `locked: [16, 190, 62, 56]`: grass left of the vertical path, under the konica
  - `letter: [128, 336, 44, 44]`: grass between the kitchen and the lower path
  - `key: [184, 336, 44, 44]`: next to the letter icon, drawn only for admin
- The collapsed „?“ of the noticeboard stays inside the `notice` rect. The organizer can move all of these in `chata.yaml`.
- Affects: T-001, T-005, T-007.
- **Answer:** default positions accepted and now in the `proposal.md` example.

## Q12. When does the noticeboard collapse?

The proposal says the noticeboard is open on the first visit and „potom“ (then) collapses to a „?“ icon.

- **Default:** it stays open until the user first taps the noticeboard or any bed. Then it collapses, and this is remembered in `localStorage`. Tapping „?“ opens it again.
- Affects: T-005.
- **Answer:** default accepted.

## Q13. „Na všetky naše noci“ with several slots

After the Q3 answer, „Zapísať nás sem“ takes several slots in one all-or-nothing `assign`. The second choice, **Na všetky naše noci**, still calls `/api/assign-stay {slot, party_id}`, which takes **one** slot (proposal „Endpointy“). A couple tapping a double bed for all their nights therefore needs one call per slot. Those calls are not atomic together: the first slot can be written while the second is skipped or fails.

- **Default:** keep the API as in the proposal. The page calls `assign-stay` once for each slot that „Zapísať nás sem“ would take on the selected night, one after another, and reports the `skipped` nights for each place. No undo.
- **Alternative for the organizer:** change `assign-stay` to `{slots[], party_id}`, writing per night the slots that are all free and skipping a night as a whole otherwise. That is a small change in T-001 and T-004.
- Affects: T-006 (and T-001, T-004 if the alternative is chosen).
- **Answer:** change `assign-stay` to `{slots[], party_id}`. For each night of the stay, all listed slots are written together, or the night is skipped and listed in `skipped`. The whole request is one write (one version bump, backup and audit entry). If every night is skipped, apply the Q5 rule: `409 slot_taken`, nothing written. Affects T-001, T-004, T-006.

## Q14. The party table under the night signposts (T-023)

The organizer asked for a table of all parties with their places per night on the grass under the signposts. Three points are not settled by the request:

- **What a cell shows.** Default: placed / needed places, e.g. `2/3`, the same numbers as the signpost chip (`2/3!` on red when places are missing, amber when there are extra, `–` when the party is not there that night). Alternative: only the placed count (`2`), or only the needed count.
- **Columns cannot sit exactly under the signposts.** The third signpost is above the collapsed „?“ box and the names need their own column. Default: the table is left of the „?“ box (`map.scene.parties: [176, 112, 148, 82]`) with a header row of night labels (`Št → Pi`, …), and the selected night's header is yellow. Alternative: move the „?“ box elsewhere and give the table the full width (a layout change in `chata.yaml` and `drawNotice`).
- **The expanded noticeboard covers the same grass.** Default: the table is drawn only while the notice is collapsed to „?“ (after the first bed tap or a tap on the notice). The screen-reader summary always has the data.
- Also a default: the „Kto je kto“ sign stays, and tapping the table opens „Kto je kto“, whose rows gain a line with the per-night numbers at normal text size, because the table text is about 5 px on a 380 px phone.
- Affects: T-023.
