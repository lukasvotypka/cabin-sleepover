# Manual checklist

Things that cannot be checked by pytest or Node tests. T-008 extends and finalizes this file.
Items are grouped by the task that produced them.

## T-003: app, join, cookies, limits, state

- [ ] Behind Caddy over HTTPS, join with the group code from the phone: the cookie is stored (`Secure`, `HttpOnly`, `SameSite=Lax`) and `GET /api/state` works after closing and reopening the tab. Check on iPhone Safari, Android Chrome, and the WhatsApp in-app browser (it may not keep cookies; note what happens).
- [ ] uvicorn runs with `--proxy-headers --forwarded-allow-ips=127.0.0.1`: the wrong-code limit (10 per minute) is counted per real client IP, not for everyone together. Try 11 wrong codes from one phone, then a correct code from a second phone on other mobile data: it must still join.
- [ ] Several friends on the same Wi-Fi join within one minute with the correct code: nobody gets `rate_limited` (only wrong codes count).
- [ ] After changing `GROUP_CODE` in `.env` and restarting, an already joined phone gets the join dialog again (the old cookie no longer works). After changing only `ADMIN_CODE`, the group access stays and only admin access is lost.
- [ ] After editing `config/chata.yaml` and restarting, an open tab and a reloaded tab show the new layout (the `ETag` changes, no stale 304).
- [ ] `journalctl -u <service>` shows the app log lines (`join as ...`, `wrong code attempt from <ip>`), shows the real client IP behind the proxy, and never shows a code.
- [ ] `GROUP_CODE`, `ADMIN_CODE` and `SECRET_KEY` (at least 32 characters) are loaded through systemd `EnvironmentFile=`. With one removed the service refuses to start and the English reason is in the journal.
- [ ] From outside, `https://<host>/data/chata-data.yaml`, `/config/app.yaml`, `/.env`, `/files/mapa-nahlad.html`, `/docs` and `/openapi.json` all return 404 (also through the Caddy config, not only direct to uvicorn).

## T-004: write endpoints

- [ ] Two phones tap the same free bed within the same second: exactly one gets the bed, the other sees the „obsadené“ message naming the winner, and its map refreshes to show the winner. Nothing ends up half written.
- [ ] A couple tapping „celý pobyt“ on a bed that is taken on one night: the free nights are written, the taken night is reported as skipped, and the map shows the same on the second phone after its next poll.
- [ ] Shortening a party's stay in the form (phone): the page names the slots that will be freed first, and after saving they are free on the map of the other phone.
- [ ] Behind Caddy, `data/audit.yaml` grows by one YAML document per write with the right `source` (`mapa` or `formular`) and an anonymous `client_id`, and `data/backups/` stays at 50 files after many writes (check after the first real evening of use).
- [ ] 30 quick taps from one phone within a minute (for example clearing and assigning repeatedly): the 31st shows the Slovak „príliš veľa zmien“ style message, and the phone recovers after about a minute.

## T-005: scene frame, code screen, „Kto si?“

- [ ] On a real phone (iPhone Safari and Android Chrome, ~380 px wide) the scene fills the width and the small sign texts are readable: the date lines on the three night signposts, „obsadené X z 20“, the „aktualizované pred … s“ line, and above all the red „V sobotu vám chýba 1 miesto“ sign. If the red sign is too small to read, raise only its text size.
- [ ] Tapping the three night signposts, the red sign, the amber sign, the noticeboard and the „?“ icon with a thumb works on the first tap, also when the tap lands slightly above or below a signpost (44 px minimum). Pinch-zoom still works.
- [ ] Alegreya and Alegreya Sans load from Google Fonts on the code screen and in the panels (WhatsApp in-app browser too). With no network to Google the fallback fonts look acceptable.
- [ ] The page in dark mode on the phone: the scene keeps its colors, the code screen and panels turn dark and stay readable.
- [ ] Two phones: after phone A changes the data (T-006), phone B shows it within 30 s without a reload, and „aktualizované pred … s“ counts up and resets after each poll. Returning to the tab from another app refreshes at once.
- [ ] Opened from the WhatsApp link for the first time: the code screen appears, after the correct code „Kto si?“ opens, and after choosing a party the noticeboard is open. Close the page, open it from the link again: the party and the collapsed or open noticeboard are remembered.
- [ ] Deployed under the final URL (and, if used, a sub-path such as `/chata/`): the page loads and `api/...` calls work (relative paths).

## T-006: beds, bed sheet, assign / clear / move

- [ ] Long press on a bed with a finger (iPhone Safari and Android Chrome) shows the small board with the occupants' names and does not open the sheet. A resting finger emits tiny `pointermove` events, so check that the long press really fires and is not cancelled by finger jitter (it was only checked with synthetic touch events). A short tap opens the sheet.
- [ ] Two phones tap „Zapísať nás sem“ on the same free bed within the same second: the slower one sees „Toto miesto má … už …“ in the toast, its pending figure disappears and the map shows the winner.
- [ ] On a phone, the tap targets of the small beds (cots, 1-bed, bunks, about 32-40 px wide) can be hit with a thumb on the first or second try. If not, widen the bed hit areas (Q9).
- [ ] Move mode on a phone: after the sheet closes the bar appears above the scene and the scene may jump down a little. Check that the next tap still lands on the intended bed, and that „Zrušiť“ and „Táto noc / Všetky noci“ are easy to hit.
- [ ] Pending state („ukladám“, semi-transparent figures) is visible for a moment on a slow mobile connection (throttle to 3G), and the map returns to the server state after a rejection.
- [ ] Screen reader (VoiceOver and TalkBack): beds are announced as buttons with the label „<bed>, <room>, v <night> <who>, N voľných“, the sheet is announced as a dialog and focus returns to the bed on close.
- [ ] The „Chodbička“ room label is squeezed to fit the 54-unit corridor and the „Letná kuchynka“ label touches the stove pipe. Look at both on a phone and decide with the organizer whether to shorten the names in `config/chata.yaml`.
- [ ] Pinch-zoom on the map and on the open sheet still works on iPhone and Android.
