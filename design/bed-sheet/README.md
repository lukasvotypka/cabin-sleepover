# Bed sheet with night tabs (T-149) – prototype

Reference only, never served by the app. One self-contained file, no requests, fake data.

Open `index.html` in a browser (or any static server). The bed sheet opens over a dimmed map stand-in; tap the bed on the map to reopen it.

- Toolbar (top, not part of the app): scenario (missing places, all set, bed full with a phone-protected party, arriving Friday, no party chosen, signup locked), theme (auto/light/dark), „chyba pri uložení“ (fake rollback with error toast), „bez animácií“ (reduced motion).
- Shows: night tabs with 8×8 place squares (mine with amber outline, free dashed), status line, „+ Ľahnúť si sem“ rows with „na celý pobyt“ / „aj v …“, „Uvoľniť“ with the „Celý pobyt (N noci)“ / „Len v …“ / „Nie“ confirm when the place is held 2+ nights, the „Uvoľnené. Ťukni na nové miesto na mape.“ toast, „ukladám…“ pending state, and the hidden main button when it would duplicate the row button.
- Tabs move the stamps in the HUD stand-in, as `selectNight` would.
- Fonts fall back to Georgia/system sans (no Google Fonts request); the app uses Alegreya and Alegreya Sans.
