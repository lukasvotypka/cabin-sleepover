# Prototype: fixed top HUD and the notice board in the village

Reference only, never served. Open `index.html` directly (no server). Drag to pan, wheel or pinch to zoom, double-click zooms, „Celá mapa“ resets. Query flags: `?phone` (390×844 frame), `?zoom` (zoomed on the board), `?panel` (panel open).

- **Top HUD (fixed, 92 px):** three perforated date stamps (`Št → Pi`, dates, `11/20` occupancy, my chip `4/4`, amber `3/4`, green, red, „nie si“) plus the time rail, whose three segments line up under the stamps. A stamp tap = select night + time-lapse (one jump per hour, steps); dragging the knob sets the time and shows `18:00`. Only the world darkens at night, never the HUD. On windows under 620 px tall the date line hides.
- **In the village:** a „Kto kedy príde“ notice board standing on the front meadow, with two pinned stamps, „Noc“ (party, `Št–Ne`, placed/needed per night) and „Cez deň“ (day visits, „na jedlo“ per day). You can read it when zoomed. A tap (wiggle in steps) opens the readable panel with „Noc“ / „Cez deň“ tabs (bottom sheet on phone, window on desktop).
- **Title:** a wooden gate over the entrance path, „Chata 29. 10. – 1. 11.“. The stamps already show the dates and the WhatsApp link has the name, so the HUD stays short.
- **Icons (Návod, Info, Prehľad, Pred cestou):** in the bottom HUD next to „Si: …“. They are tools you need at any zoom, and the bottom is where the thumb is. The world is for things you look at, the HUD for things you use.

Open choices (recommended default first):
1. Icons: **bottom HUD** / keep them in the world as a „village square“ beside the board (more game-like, but you have to find them after panning).
2. Board: **one board with two stamps** / one small stamp per party scattered at each house (cute, but no overview).
3. Board place: **front meadow, never behind a roof at any of the 4 angles** (needs a spot per angle or one that turns to face the camera) / beside the title gate.
4. Title: **gate in the world** / a thin line above the stamps (+16 px HUD).
