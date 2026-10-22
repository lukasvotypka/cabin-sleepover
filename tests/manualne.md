# Manual checklist (phase 1)

Things that pytest and the Node tests cannot check: the real server, real phones, two people at once, screen readers. Go through it once on the deployed copy (after following `README.md` on a clean server) and again after bigger changes. Tick a box only after you have seen it.

Devices to use: an iPhone with Safari, an Android phone with Chrome, a desktop browser, and a second phone for everything marked "two devices". Test with the final URL (and the WhatsApp in-app browser where noted).

Items that are only a question for the organizer are at the end, in "Decisions to confirm".

## 1. Deploy, server and files

- [ ] **Clean server:** following only `README.md` (install Docker, clone, supply the three secrets as environment variables, create `data/` with the right owner, `docker compose up -d --build`, add Caddy), the container becomes „healthy“ and the page opens. Note anything in the README that was wrong or missing.
- [ ] **HTTPS works:** `https://<host>/` opens with a valid certificate, `http://` redirects to it, and the page works on a phone over mobile data.
- [ ] **Final URL and sub-path:** under the real URL (and, if used, a sub-path such as `/chata/`) the page loads and the `api/...` calls work (relative paths).
- [ ] **Non-root, read-only container:** `docker compose exec chata id` shows a non-root user. The app can write `data/` (the first start created `data/chata-data.yaml` with the right owner), and it cannot write elsewhere (`docker compose exec chata touch /app/x` fails). `ss -ltn` on the host shows port 8010 only on `127.0.0.1`, never on `0.0.0.0`.
- [ ] **Restarts on failure and after reboot:** `docker kill <container>` brings it back within a few seconds, and after a reboot of the server the app is up again without a manual step (`restart: unless-stopped`). `docker compose top` shows one uvicorn process with `--workers 1`.
- [ ] **Restart keeps the data:** assign a few places, `docker compose restart` (and once `docker compose down` followed by `docker compose up -d`), reload the page: everything is still there, and the version in `data/chata-data.yaml` did not go back.
- [ ] **Secrets as environment variables:** `GROUP_CODE`, `ADMIN_CODE` and `SECRET_KEY` (at least 32 characters) reach the container only through the environment (`docker compose exec chata printenv GROUP_CODE`). With one of them missing, `docker compose up` refuses with a „set …“ message. With a too short `SECRET_KEY` the container exits and the English reason is in `docker compose logs`. The code values never show up in the logs. There is no `.env` on the server (not in the project directory and not in the image: `docker compose exec chata ls -a /app`).
- [ ] **Corrupt data file:** stop the container, break `data/chata-data.yaml` (a bad indent, then an unknown slot ID), start it. The app does not start, and `docker compose logs` shows an English message that names the file and the line or entry. After fixing the file (and `docker compose start`) it runs again.
- [ ] **Timezone data:** `docker compose exec chata python -c "import zoneinfo; print(zoneinfo.ZoneInfo('Europe/Bratislava'))"` works, and the times in `audit.yaml` and in the page make sense.
- [ ] **Audit and backup are created:** after a real write behind Caddy, `data/audit.yaml` grew by one YAML document with the right `source` (`mapa` or `formular`) and an anonymous `client_id`, and `data/backups/` holds a new copy. After many writes (check after the first real evening of use) `data/backups/` stays at 50 files.
- [ ] **Backup restore drill:** copy `data/` away (README, "Back up"), make a change on the page, then follow README "Restore from `data/backups/`" (`docker compose stop`, copy a backup over `chata-data.yaml`, `chown`, `docker compose start`): the page shows the restored state.
- [ ] **Hand fix:** README "Fix the data by hand" works as written (stop, edit, start, and a mistake is reported at start).
- [ ] **Changed layout:** after editing `config/chata.yaml` and `docker compose restart` (no rebuild), an open tab and a reloaded tab show the new layout (the `ETag` changes, no stale 304).
- [ ] **Not reachable from outside:** `https://<host>/data/chata-data.yaml`, `/data/audit.yaml`, `/config/app.yaml`, `/.env`, `/files/mapa-nahlad.html`, `/docs` and `/openapi.json` all return 404, also through the Caddy config and not only straight to the container.

## 2. Group code, cookie and limits

- [ ] **Group code works:** opened from the WhatsApp link for the first time, the code screen appears. A wrong code shows a Slovak message, the correct code opens „Kto si?“.
- [ ] **Cookie is kept:** behind Caddy over HTTPS the cookie is stored (`Secure`, `HttpOnly`, `SameSite=Lax`) and the page works after closing and reopening the tab. Check iPhone Safari, Android Chrome and the WhatsApp in-app browser (it may not keep cookies, note what happens).
- [ ] **Remembered choices:** after choosing a party the noticeboard is open. Close the page and open it from the link again: the party and the collapsed or open noticeboard are remembered.
- [ ] **Wrong-code limit is per real client IP:** 11 wrong codes from one phone give the „príliš veľa pokusov“ message. A second phone on other mobile data can still join with the correct code. This proves `X-Forwarded-For` is trusted only from Caddy.
- [ ] **Shared Wi-Fi:** several friends on the same Wi-Fi join within one minute with the correct code, and nobody gets the limit message (only wrong codes count).
- [ ] **Changing a code:** after changing `GROUP_CODE` where you keep it and running `docker compose up -d` (a plain `restart` does not pick up new values), an already joined phone gets the code screen again. After changing only `ADMIN_CODE`, the group access stays.
- [ ] **Write limit:** 30 quick taps from one phone within a minute (for example clearing and assigning repeatedly): the 31st shows the Slovak „príliš veľa zmien“ style message, and the phone recovers after about a minute.
- [ ] **Logs:** `docker compose logs` shows the app lines (`join as ...`, `wrong code attempt from <ip>`) once each (not doubled), with the real client IP behind the proxy (not the Docker gateway address).

## 3. Two devices

- [ ] **Same free slot at once:** two phones tap „Zapísať nás sem“ on the same free bed within the same second. Exactly one gets it. The other sees the „Toto miesto má … už …“ message naming the winner, its pending figure disappears and its map is correct again. Nothing ends up half written.
- [ ] **Overlapping places at once:** two parties take overlapping places at the same moment (for example both want the same double bed on one night). Exactly one booking wins whole, the other is rejected whole, and no party holds only half of its request.
- [ ] **A change shows up within 30 s:** after phone A changes the data, phone B shows it within 30 s without a reload, and „aktualizované pred … s“ counts up and resets after each poll. Returning to the tab from another app refreshes at once.
- [ ] **Shortened stay on two phones:** phone A confirms the freed places, phone B shows them free after its next poll.
- [ ] **Pending state:** „ukladám“ (semi-transparent figures) is visible for a moment on a slow connection (throttle to 3G), and the map returns to the server state after a rejection.

## 4. Booking on the map

- [ ] **A couple fills a double bed with one tap:** „Zapísať nás sem“ on a double bed puts both people in with one tap (one figure per slot, the bed looks full).
- [ ] **All nights:** a couple using „celý pobyt“ on a bed that is taken on one night: the free nights are written, the taken night is reported as skipped, and the second phone shows the same after its next poll.
- [ ] **Amber note:** when a party holds more places than it needs for a night, the amber note appears in the scene, and it disappears when the extra place is cleared.
- [ ] **Move:** moving a booking for one night, and for all nights, both work. Afterwards the old place is free and the new one is held on the other phone as well.
- [ ] **Move mode on a phone:** after the sheet closes the bar appears above the scene and the scene may jump down a little. The next tap still lands on the intended bed, and „Zrušiť“ and „Táto noc / Všetky noci“ are easy to hit.
- [ ] **Stay shortening:** shortening a party's stay in the form on a phone: the page names the slots that will be freed first, and after saving they are free on the map of the other phone.
- [ ] **Missing places:** the red „V sobotu vám chýba 1 miesto“ style sign shows when a party needs more places than it holds, and goes away when it has enough.

## 5. What the page shows, and its language

- [ ] **Drawn from `/api/state`:** the event title and dates, the three night signposts with „obsadené X z 20“, the noticeboard, the my-party status and its warning are drawn inside the map. Change the data on another device and they change after the next poll.
- [ ] **Slovak and informal everywhere:** every visible text (scene, panels, the code screen, the form, error and toast messages) is Slovak, uses tykanie and „ “ quotes. Provoke each error you can (taken slot, party not present, duplicate party name, empty name, rate limit, server stopped, expired cookie). No English server `message` ever shows up on the page.
- [ ] **Readable on a phone (~380 px):** the date lines on the night signposts, „obsadené X z 20“, the „aktualizované pred … s“ line and above all the red missing-places sign are readable. If the red sign is too small, raise only its text size.
- [ ] **Tally chips on the night signposts (T-013):** with a party chosen, the three signposts show a chip `máte X/Y` instead of the dates: red with „!“ when places are missing, orange when there are more, green when they match, and plain `nie ste tu` on nights outside the stay. Without a chosen party the signposts show the dates and no chips. The chips change after an assign or release and after switching party in „Kto si?“. The text is readable on a 380 px phone (pinch zoom allowed).
- [ ] **„Kto je kto“ (T-014):** the small sign with three colour squares (on the grass left of the house) is visible and opens the list of parties. The swatch colours match the figures on the map, my party is marked „(vy)“, and each row shows the people and the stay (e.g. „2 dospelí, 1 dieťa · Št 29. 10. – Ne 1. 11.“). Add or rename a party on another device: the open list follows after the next poll. „Vybrať moju partiu“ opens „Kto si?“.
- [ ] **Shirt letter (T-018):** create parties „Novákovci“, „Šimon a Ela“, one whose name starts with an emoji and one starting with „Ł“. Their figures show N, S, the first letter after the emoji, and a dot. Rename a party on one device: after the next poll the letters change on the other device. A figure that is still „ukladám“ fades together with its letter.
- [ ] **Fonts:** Alegreya and Alegreya Sans load on the code screen and in the panels (also in the WhatsApp in-app browser). With no network to Google Fonts the fallback fonts look acceptable.
- [ ] **Room labels:** the „Chodbička“ label is squeezed into the 54-unit corridor and „Letná kuchynka“ touches the stove pipe. Look at both on a phone.

## 6. Phones, desktop, modes and zoom

- [ ] **iPhone Safari, Android Chrome and desktop, each in light and dark mode:** the map and all panels work. In dark mode the scene keeps its colors, and the code screen and panels turn dark and stay readable.
- [ ] **Full-screen map (T-011):** on iPhone Safari (portrait and landscape), in the WhatsApp in-app browser and on Android Chrome, the map fills the whole screen: no dark band, no page scroll, no rubber-banding of the page, and the grass also goes behind the status bar and the Safari toolbar area. The scene is whole and centered, never cropped or stretched. Rotate the phone and show or hide the Safari toolbar: the map refits, and a zoomed view stays zoomed and valid. Boards, beds, „Celá mapa“, the toast and the move bar stay clear of the notch and the home bar. On a desktop window, resize it wide and narrow.
- [ ] **Autumn palette (T-012):** on iPhone Safari and on desktop, in light and in dark mode: the grass is dry olive with rust, ochre and dark red fallen leaves (colour only, same places as the tufts), the paths are sandy, panels and the code screen are warm brown and cream (dark mode: dark brown), all text is readable, and party swatches stay distinct from the panel in both modes (in dark mode they have a light border). There is no colour flash between loading, code screen and map.
- [ ] **Loading leaf (T-012):** the loading view shows a pixel leaf falling in steps onto the grass and „Načítavam…“ on a small wooden sign, immediately on page start (see the intro items below for how long it stays).
- [ ] **Loading leaf, reduced motion (T-012):** with „Reduce motion“ on, the leaf is still.
- [ ] **Loading leaf, failed load (T-012):** stop the server (or block `/api/state`) and reload: the text changes to „Nepodarilo sa načítať, skúšam znova…“ and the leaf lies still on the ground. Start the server again: the map appears.
- [ ] **Loading intro (T-015):** on the tailnet (fast), reload: the leaf falls once onto the grass with „Načítavam…“ (about 2.5 s), then the view fades into the map. With network throttling (slow 3G) the map appears as soon as the data are loaded, with no extra pause after that.
- [ ] **Loading intro, reduced motion (T-015):** with „Reduce motion“ on, the still leaf shows briefly (under a second) and the map appears without a fade.
- [ ] **Loading intro, failed load (T-015):** stop the server and reload: the error text and the lying leaf appear at once, without waiting for the intro. Start the server: the map appears.
- [ ] **Loading intro and the code screen (T-015):** in a private window (no cookie) the code screen appears at once; after the code the leaf intro plays once, then the map and „Kto si?“. Switching tabs and coming back, or waiting for a poll, never shows the leaf again.
- [ ] **Move mode in landscape (T-011):** on a phone in landscape, tap your bed, choose „Presunúť“: the map shrinks a little so the whole scene sits below the move bar, and every bed (also „Konica, podkrovie“ and the signposts) is visible and tappable. „Zrušiť“ or finishing the move gives the full-size map back, and a zoomed view stays zoomed through both changes. In portrait nothing is hidden either.
- [ ] **Small targets in landscape at 1x (T-011):** in landscape the whole map is smaller than it was (about 0.8 to 0.95 px per unit), so a cot is under 44 px. Try tapping the cots, the mats and the 1-bed beds at 1x on a real phone. If it is too fiddly, zooming in (pinch) must make it easy.
- [ ] **Panels in landscape and with the keyboard (T-011):** the code screen with the keyboard open (also in the WhatsApp browser on Android) can be scrolled up to the „Chata“ heading, and a long party form sheet stays below the status bar or Dynamic Island and does not make the page rubber-band when you fling it at its end.
- [ ] **Pinch zoom and pan of the map (touch):** on iPhone Safari and Android Chrome, also inside the WhatsApp in-app browser, two fingers zoom the map around the fingers (between the whole map and about 4x), the fingers' movement pans it, and the page itself does not zoom. Zoomed in, one finger drags the map. Let go and tap: nothing opens after a drag.
- [ ] **Wheel and trackpad zoom (desktop):** the mouse wheel and a trackpad pinch (also in Safari on a Mac) zoom the map around the pointer, the page does not scroll over the map, and zoomed in a mouse drag pans. The keys `+`, `-` and `0` zoom and reset when a bed has focus, and Tab keeps the focused bed in view.
- [ ] **Tapping a small bed while zoomed:** zoom in on the cots and the 1-bed beds, a short tap opens the sheet, a long press shows the names, a drag only pans. The zoom stays through the 30 s refresh, writes and night switches.
- [ ] **„Celá mapa“:** the button appears only when zoomed in, is easy to hit with a thumb, and returns to the whole map. With „Reduce motion“ on there is no animation (there is none anyway).
- [ ] **Two-finger pan feel at the zoom limits (T-010 tester note):** at 4x and at the whole map, drag two fingers together without spreading them. The zoom should not drift by more than a few percent (the first finger's move arrives before the second's, which can nudge the zoom once at a limit).
- [ ] **Page pinch-zoom elsewhere:** pinch-zoom still works on the open sheet and the panels (only the map takes the pinch for itself).
- [ ] **No zoom on focus:** on iPhone Safari, tapping the code field, any field of the party form and the „Prehľad na poslanie“ text does not zoom the page (all are 16 px or larger).
- [ ] **Reduced motion:** with „Reduce motion“ on in the system settings the blinking of free places and the signs stops.
- [ ] **„Kto je kto“ on a phone (T-014):** on a 380 px phone the sign is at least 44 px and easy to hit on the first tap. The list is readable and scrolls with a thumb in light and in dark mode, and in dark mode the swatches have the light border, so dark party colours stay visible. The stay line („Št 29. 10. – Ne 1. 11.“) does not break a date across two lines (a headless 380 px check wrapped „Ne 1.“ / „11.“; a `white-space: nowrap` on each date would fix it, decide with the organizer).
- [ ] **Shirt letter on phones and zoom (T-018):** on a 380 px iPhone and Android phone and on desktop, at 1x the letters are visible as letters when you look closely, and at 2x to 4x zoom they read clearly. Kids' letters are readable, or note for the organizer that they are not. Create 12 parties on the trial server: the letter is readable on each of the 12 colours. In dark mode the scene and the letters keep their colours. The swatch letters in „Kto je kto“ match the ones on the map.
- [ ] **Touch targets:** the three night signposts, the red and amber signs, the noticeboard and its „?“ icon, the letter icon and the panel buttons are hit with a thumb on the first tap, also when the tap lands slightly above or below a signpost (44 px, `tasks/QUESTIONS.md` Q9). The small beds (cots, 1-bed, bunks, about 32–40 px wide) can be hit on the first or second try. If not, widen the bed hit areas.
- [ ] **Long press:** a long press on a bed with a finger (iPhone Safari and Android Chrome) shows the small board with the occupants' names and does not open the sheet. A resting finger emits tiny `pointermove` events, so check the long press is not cancelled by finger jitter (so far only synthetic touches were tried). A short tap opens the sheet.

## 7. Party form and „Prehľad na poslanie“

- [ ] **Party form on a phone:** the number fields bring up the numeric keyboard, the Slovak error text appears right under the field with the keyboard open (not hidden behind it), and „Uložiť“ stays reachable. An empty name shows „Napíš meno partie.“. Opening the form from the sheet's „Upraviť príchod a odchod“ puts focus on the name field: check this does not feel odd with the keyboard.
- [ ] **Copy:** „Kopírovať“ on iPhone Safari, Android Chrome and the WhatsApp in-app browser: paste into a WhatsApp chat and check the text is complete (all nights, the „Chýbajú miesta“ block, the page link, no code). Where `navigator.clipboard` is blocked, the text is selected and the Slovak „Text je označený, skopíruj ho.“ is shown. (So far tried only in desktop headless Chrome.)
- [ ] **Texts match the map:** „Prehľad na poslanie“ and the hidden text summary agree with what the map shows (same parties and places, per night).

## 8. Screen reader (VoiceOver on iPhone, TalkBack on Android)

- [ ] **Beds:** announced as buttons with the label „<bed>, <room>, v <night> <who>, N voľných“. The sheet is announced as a dialog and focus returns to the bed when it closes.
- [ ] **Night signposts (T-013):** with a party chosen, each signpost also reads the tally sentence (e.g. „Máte 2 miesta, potrebujete 3, chýba 1 miesto“ or „V túto noc tu nie ste“) after the occupancy.
- [ ] **„Kto je kto“ (T-014):** the sign is read as „Kto je kto. Ťuknutím uvidíš partie a ich farby.“ The panel reads each row as name, „(vy)“ for my party, people and stay, so nothing depends on the colour. Focus returns to the sign when the panel closes.
- [ ] **Shirt letter (T-018):** VoiceOver and TalkBack read the beds and the „Kto je kto“ rows exactly as before, with no extra letter (the letters are hidden from them).
- [ ] **Hidden summary:** the text summary after the map is reachable and read per room and bed. The night headings read „Noc Št → Pi“: check how the arrow is read (maybe „right arrow“) and consider „zo štvrtka na piatok“.
- [ ] **Form:** the party form fields are announced with their labels and the field errors are read out.

## Decisions to confirm with the organizer

These are not defects, they are the developer's own choices that need a human opinion.

- [ ] Editing your own party goes board → „Kto si?“ → „Upraviť partiu“ (two taps, intended). Is that clear enough?
- [ ] Read one real „Prehľad na poslanie“ text and approve or change the phrases (headings, „(N voľné)“, „Chýbajú miesta:“, „Tu sa zapíšeš:“).
- [ ] Shorten „Chodbička“ and „Letná kuchynka“ in `config/chata.yaml` if the labels look bad (no code change needed).
- [ ] The open decisions listed in `README.md` (section 6) still have the defaults.
