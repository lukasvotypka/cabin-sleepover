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
