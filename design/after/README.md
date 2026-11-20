# Prototype: the page after the event

Reference only, never served. Open `index.html` directly (no server, no requests, fictional data). The black bar on top is prototype chrome: variants A/B, „čísla: áno/nie“ (with or without the three whole-event totals), „znova“ replays the entry animation.

Organizer's rule (20. 11. 2026): from the first day after the event the page shows **nobody's sleeping data**: no names, no figures in beds, no per-night or per-bed occupancy, no „kto kde spal“ tables or trivia.

- **A Zatvorená chata (recommended, default; the successor of the earlier variant C):** the same village, closed. Roofs on, no smoke, cold campfire, leaves falling (steps, off with reduced motion), a padlock on every door. A tap on a house rattles the padlock and says „Zamknuté. Vidíme sa nabudúce!“. The gate gets a hanging plank „Vďaka, že ste prišli!“, the notice board says „Bolo nás“ with three whole-event totals (people, parties, nights) and a red „ZATVORENÉ“ stamp. The bottom HUD has one sign („Chata je zatvorená · zapisovať sa už nedá“) and one button, „Čo teraz“ (thank-you panel). No night stamps, no time rail, no „Si: …“, no „Kto si?“, „Kto je kto“, „Prehľad“, „Pred cestou“, presence, SSE or phone login.
- **B Len poďakovanie:** no map, just the splash landscape with a closed cabin and a thank-you plate. Simplest and cheapest to build, but loses the village the group knows.

Totals: only whole-event sums (people, parties, nights) of a group that already knows who came; nothing per night, per bed or per party, so nobody can be singled out. Optional (`čísla`); drop them if even that is too much.

Suggested switch (not decided): server derives `ended` from `config/cabin.yaml` (true from the day after the last `leave_days` entry, optional `event.ended` override for testing). When ended, `/api/state` carries only event, layout, `ended: true` and optional `totals`; no `parties`, `sleeping`, `presence`, `info`; writes return a new code `event_ended` (403); `/api/events` and SMS endpoints are off.

Wording: „Chata je zatvorená“ (HUD sign) and the stamp „ZATVORENÉ“ (not „zbalené“, which is said of luggage). Alternatives for the organizer: „Chata odpočíva“, „Dovidenia nabudúce“.
