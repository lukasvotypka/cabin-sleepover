# Chata 29. 10. – 1. 11.: zadanie pre Claude Code

Oct 21, 2026 · @Lukas Votypka

## Cieľ a kontext

Postav malú webovú aplikáciu na rozdelenie spania na chate. Kamaráti si na pixelovej mape chaty sami vyberú, kto kde spí v ktorú noc. Organizátor vidí aktuálny stav bez prepisovania správ z WhatsAppu.

**Celá aplikácia je jedna stránka a tou je mapa.** Termín, návod, prepínač nocí aj stav zápisu sú nakreslené priamo v pixelovej scéne, takže je to minihra a infostránka v jednom. Žiadna samostatná hlavička, zoznam ani prehľadová stránka. Formuláre a potvrdenia sa otvárajú ako panely nad mapou.

**Akcia:** 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa), tri noci: Št → Pi (29./30. 10.), Pi → So (30./31. 10.), So → Ne (31. 10./1. 11.). Asi 8 až 10 partií, 13 až 18 ľudí vrátane detí. Kapacita je 18 bežných a 2 tesné miesta.

**Ľudia** komunikujú cez WhatsApp skupinu a aplikáciu otvoria z odkazu na mobile. Nemajú účty a nechcú sa registrovať. Väčšina sa zapíše ťuknutím na mapu, niektorí to nechajú na organizátora.

**Prečo takto:** vlastný jednoduchý backend v Pythone (FastAPI) na organizátorovom serveri. Dáta sú v čitateľných YAML súboroch na disku, takže ich organizátor vie v núdzi opraviť v editore a zálohovať obyčajným kopírovaním. Žiadna databáza ani externé služby, okrem voliteľného Claude API vo fáze 2.

**Pravidlá pre stavbu:**

- **Jazyky:** celé UI (texty v scéne, panely, hlášky pre kamarátov, mená izieb a postelí v `config/cabin.yaml`) je po slovensky, s tykaním a typografickými úvodzovkami „ “. Kód, názvy, komentáre, logy, chyby pri štarte servera, testy a README sú po anglicky. Server neposiela používateľom slovenské texty: chyby majú stabilný `code` a stránka ich mapuje na slovenské hlášky (sekcia HTTP API, Odpoveď). Tykanie znamená 2. osobu jednotného čísla (máš, si, ti). Text oslovuje jedného človeka („Si: Ivan a Eva“, „V sobotu ti chýba 1 miesto“). Kde ide o viac ľudí, text hovorí „vy“ / „z vás“ („Na lúke 2 z vás bez postele“). Formálne vykanie („Zadajte“, „vaša“ ako oslovenie jednej osoby) sa nepoužíva. Prvá osoba množného čísla v tlačidlách („Zapísať nás sem“, „Na všetky naše noci“) ostáva. Rozhodnutie organizátora z 24. 10. 2026: UI nikdy nepoužíva slovo „partia“ (kamaráti mu nerozumeli, vnímali ho ako celú skupinu); pýta sa „Kto si?“. Interný pojem `party` v kóde a API ostáva.
- Najprv mobil (šírka okolo 380 px), potom desktop.
- Frontend bez build kroku a bez frameworku: čisté HTML, CSS a JavaScript v jednom súbore, servírovaný z FastAPI.
- Pixelová grafika je vlastná, v štýle starých RPG hier zhora. Nepoužívaj žiadne postavy, grafiku ani názvy z Pokémonu či iných hier.
- Fáza 1 je bez AI a bez admin nástrojov. Fáza 2 je voliteľná a stavia sa až po fáze 1: admin nástroje (zámka zápisu, export, zmazanie partie, ikona kľúča) a zápis vlastnými slovami cez Claude API. Rozhodnutie organizátora z 22. 10. 2026: admin sa presúva do fázy 2 a zatiaľ sa nerobí.

## Výstupy a podklady

### Čo má vzniknúť

| Súbor alebo priečinok | Obsah |
| --- | --- |
| `app/main.py` | FastAPI aplikácia: routy, cookies, servírovanie `static/` |
| `app/store.py` | Čítanie a atomický zápis YAML, zámok, `version`, zálohy, audit |
| `app/models.py` | Pydantic modely: `Party`, `Slot`, `State`, požiadavky akcií |
| `app/validate.py` | Kontroly zápisov (voľné miesto, prítomnosť, presun, skrátenie pobytu) ako čisté funkcie |
| `app/ratelimit.py` | Jednoduché limity v pamäti |
| `app/llm.py` | Fáza 2: volanie Clauda a nástroj `propose_signup` |
| `static/index.html` | Celá stránka: jedna pixelová scéna s termínom, návodom a stavom zápisu, panely nad ňou (formulár partie, „Kto si?“, prehľad na poslanie, admin) |
| `config/cabin.yaml` | Akcia, noci, izby, postele, sloty a súradnice pre mapu |
| `config/app.yaml` | Limity a nastavenia aplikácie |
| `data/` | `cabin-data.yaml`, `audit.yaml`, `backups/`. Mimo gitu, vytvorí sa pri prvom štarte |
| `tests/` | pytest a httpx pre backend, Node testy čistých funkcií stránky, ručný kontrolný zoznam |
| `Dockerfile`, `compose.yaml`, `deploy/` | Docker obraz a `compose.yaml` na spustenie, príklad konfigurácie Caddy (rozhodnutie organizátora z 22. 10. 2026: Docker namiesto systemd) |
| `README.md` | Návod po anglicky (pre organizátora a vývoj): inštalácia, `.env`, spustenie, nasadenie, záloha a ručná oprava dát |
| `pyproject.toml`, `.env.example` | Závislosti a vzor premenných prostredia |

### Podklady, ktoré dostaneš

Organizátor ti do repozitára nahrá tieto súbory z predchádzajúcej práce:

- `podklady/chata-prehlad.html`: stará prehľadová stránka, **už nie je v repozitári a nepotrebuješ ju**. Jej paleta farieb partií, farby svetlého a tmavého režimu a písma sú zapísané v sekcii Vzhľad. Výpočty obsadenosti, upozornenia a text „Prehľad na poslanie“ napíš nanovo podľa tejto špecifikácie.
- `podklady/mapa-nahlad.html` (v repozitári je ako `files/mapa-nahlad.html`): náhľad pixelovej mapy, ktorý sa organizátorovi páčil. Je to jediný podklad, ktorý treba. Zachovaj jeho štýl, rozloženie a správanie, ale napoj ho na skutočné dáta a pridaj úpravy.
- `podklady/chata-spanie-tabulka.xlsx` a `podklady/make_xlsx.py`: stará verzia s Google tabuľkou, už nie sú v repozitári a nepotrebuješ ich. Zoznam miest je v `config/cabin.yaml`.

## Architektúra

Jeden proces FastAPI (uvicorn s jedným workerom) servíruje stránku aj JSON API a dáta drží v YAML súboroch na disku. Pred ním je reverzný proxy s HTTPS.

&#91;embedded content: architektúra · stránka, FastAPI, YAML na disku, fáza 2 s Claudom\]

**Čítanie:** stránka zavolá `GET /api/state` a dostane celý stav ako JSON: konfiguráciu akcie a rozloženia, partie, obsadenie slotov a `version`. Obnovuje sa každých 30 sekúnd, keď je karta viditeľná, po návrate na kartu a po každom zápise. Keď sa `version` nezmenila, server môže vrátiť `304` cez `ETag`.

**Zápis:** `POST /api/…` s telom JSON (sekcia API). Odpoveď obsahuje výsledok a čerstvý stav, takže stránka nemusí čítať znova.

**Optimistické UI:** po ťuknutí sa zmena hneď ukáže na mape ako „ukladám“. Keď ju server odmietne, mapa sa vráti do stavu zo servera a zobrazí dôvod (napr. „Toto miesto si medzitým zobral Riso a Ben“).

**Jeden proces je podmienka:** zámok (`asyncio.Lock`), limity a rozhovory fázy 2 sú v pamäti procesu. YAML je jediný zdroj pravdy. Ručná úprava súborov je možná, ale iba pri zastavenej službe. Bežné opravy robí organizátor cez akcie s admin kódom.

**Technológie:** Python 3.12, FastAPI, Pydantic v2, PyYAML, uvicorn. Frontend je čisté HTML, CSS a JavaScript bez build kroku.

## Dáta v YAML

Dva konfiguračné súbory píše organizátor, dátový súbor píše iba server. Noc sa označuje dátumom, kedy začína (`2026-10-29` je noc Št → Pi). Jeden slot je jedno miesto pre jedného človeka.

### `config/cabin.yaml`

Názov akcie, dni príchodu a odchodu, noci a celé rozloženie: izby, postele, sloty a súradnice pre mapu (sekcia Rozloženie chaty). Server ho načíta pri štarte a pošle stránke v `/api/state`, takže mapa aj kontroly vychádzajú z jedného zdroja.

### `config/app.yaml`

```yaml
limits:
  writes_per_client_minute: 30
  ai_per_client_minute: 10      # fáza 2
  ai_per_day: 200               # fáza 2
model: claude-haiku-5-5          # fáza 2
backups_keep: 50
```

### `data/cabin-data.yaml`

```yaml
version: 27
updated_at: "2026-10-25T19:02:11+02:00"
signup_open: true
parties:
  - id: p-7f3k2a
    name: Ivan a Eva
    adults: 2
    kids: 0
    kids_in_parents_bed: 0
    arrive: "2026-10-29"
    leave: "2026-10-31"
    arrival_time: okolo 18:00
    note: ""
    color: "#D07A2B"
    created_at: "2026-10-22T20:14:05+02:00"
    updated_at: "2026-10-25T19:02:11+02:00"
sleeping:                 # noc → slot → id partie
  "2026-10-29":
    left-double-1: p-7f3k2a
    left-double-2: p-7f3k2a
  "2026-10-30":
    left-double-1: p-7f3k2a
    left-double-2: p-7f3k2a
```

- `sleeping` je mapa noc → slot → partia, takže dve partie na jednom mieste v jednu noc nejdú zapísať už zo štruktúry. Voľné miesto v mape jednoducho chýba.
- Partia má stabilné `id` (`p-` + 6 náhodných znakov). Meno je unikátne bez ohľadu na veľkosť písmen a dá sa premenovať bez zásahu do `sleeping`.
- Potrebný počet miest na noc je `adults + kids − kids_in_parents_bed`. Partia je v noci *n* prítomná, ak `arrive ≤ n < leave`.
- Rozhodnutie organizátora z 24. 10. 2026: keď niekto z partie príde skôr alebo odíde neskôr, formulár stále opisuje celú partiu (najskorší príchod, najneskorší odchod). Voliteľné pole `places: {noc: počet}` je počet potrebných miest v tú noc namiesto plného počtu, vždy 1 ≤ počet ≤ plný počet. Chýba = plný počet. Nastaví ho tlačidlo v paneli otvorenom z červenej cedule (Tabuľka s partiou a stavom) cez `POST /api/places`. Keď partia v tú noc zaberie viac miest, počet sa zvýši s nimi (pri plnom počte pole pre tú noc zmizne). Uvoľnenie postele ho neznižuje. Pri úprave partie zmiznú hodnoty pre noci mimo pobytu a hodnoty nad novým plným počtom sa znížia naň. Pri štarte server odmietne neznámu noc, noc mimo pobytu a počet mimo rozsahu.
- Farbu priradí server pri vytvorení partie z palety 12 farieb (sekcia Vzhľad). Rozhodnutie organizátora z 24. 10. 2026: partia si môže farbu zvoliť sama, pri vytvorení aj pri úprave (`color` v `POST` a `PUT /api/parties`, `#RRGGBB`, uložené veľkými písmenami). Bez `color` priradí farbu server ako doteraz (pri úprave ostane stará). Farba nesmie byť príliš svetlá ani príliš tmavá (relatívna svietivosť 0,06 až 0,36), inak `invalid` s `reason` `color_too_light` alebo `color_too_dark`. Dve partie smú mať rovnakú farbu.
- Rozhodnutie organizátora z 24. 10. 2026: partia môže prísť len cez deň a nikdy nespať („denné návštevy“). Je to bežná partia (meno, farba, počty, poznámka, `arrival_time`) s poľom `day_visits` (zoznam dní udalosti, najviac 10, v úvodzovkách, uložený vzostupne) namiesto `arrive` a `leave`, ktoré sú vtedy `null`. Dni udalosti sa odvodzujú z `cabin.yaml` (od prvého `arrive_days` po posledný `leave_days` vrátane), nenastavujú sa. Takáto partia nie je prítomná v žiadnu noc, potrebuje 0 miest a nedá sa jej priradiť posteľ (`not_present`). Server odmietne (`invalid`, `params.reason`) zmiešaný režim (`stay_mode_mixed`), prázdny režim (`day_visits_empty`), len jeden z `arrive`/`leave` (`stay_incomplete`), opakovaný deň (`duplicate_day`), deň mimo udalosti (`day_outside_event`) a `kids_in_parents_bed` > 0 (`day_only_kids_in_bed`). Partie bez `day_visits` v súbore sa načítajú ako doteraz. Prepnutie partie s posteľami na denné návštevy uvoľní všetky jej miesta (`freed`).
- Dátumy a časy sú v YAML v úvodzovkách, aby ich PyYAML nenačítal ako objekty `date`.

### `data/audit.yaml`

Každý zápis sa pripíše ako samostatný YAML dokument (oddelený `---`): čas, akcia, partia, noc, slot, hodnota pred, hodnota po, zdroj (`map`, `form`, `admin`, `ai`) a anonymné ID klienta (náhodný reťazec z `localStorage`). Slúži na dohľadanie a ručné vrátenie zmien.

### Zápis bez poškodenia súboru

- Každé čítanie, úprava a zápis beží pod jedným `asyncio.Lock`.
- Atomický zápis: obsah do dočasného súboru v tom istom priečinku, `fsync`, potom `os.replace`.
- Pred každým zápisom kópia do `data/backups/` s časom v názve, ponechá sa posledných 50.
- PyYAML výhradne `safe_load` a `safe_dump` s `allow_unicode=True` a `sort_keys=False`, aby súbor ostal čitateľný.
- Pri štarte sa súbor overí cez Pydantic modely a proti `cabin.yaml` (neznámy slot, neznáma partia, noc mimo akcie). Pri chybe server nenaštartuje a vypíše, čo presne je zle. Prázdny alebo chýbajúci súbor sa vytvorí.

## HTTP API

JSON nad HTTP. Všetky cesty okrem `/`, statických súborov, `/api/health` a `/api/join` vyžadujú cookie skupiny. Admin akcie vyžadujú admin cookie. Stránka posiela v každej požiadavke hlavičku `X-Client-Id` (náhodný reťazec z `localStorage`) pre audit a limity.

### Odpoveď

Úspech vracia `200` a `{"ok": true, "state": {…}}`. Chyba vracia vhodný stavový kód a rovnaký tvar s popisom:

```json
{ "ok": false, "error": { "code": "slot_taken", "message": "Slot already taken", "params": { "night": "2026-10-31", "slot": "left-double-1", "party_id": "p-7f3k2a", "party_name": "Riso a Ben" } }, "state": { … } }
```

- `code` je stabilný identifikátor chyby. Stránka ho mapuje na slovenskú hlášku cez tabuľku kódov v `static/index.html`, napríklad `slot_taken` → „Toto miesto má v sobotu už Riso a Ben.“ Hodnoty do hlášky berie z `params` (noc, slot, partia, pole formulára).
- `message` je krátky anglický popis pre vývojára a logy. Stránka ho používateľovi nezobrazuje.
- Pre neznámy `code` stránka ukáže všeobecnú hlášku „Niečo sa nepodarilo, skús to znova.“


`state` obsahuje `version`, `updated_at`, `signup_open`, `event` (noci, dni príchodu a odchodu), `layout` (z `cabin.yaml`), `parties` a `sleeping`.

### Endpointy

| Metóda | Cesta | Prístup | Čo robí |
| --- | --- | --- | --- |
| GET | `/` | verejné | `static/index.html` |
| GET | `/api/health` | verejné | `{ok: true, version}` na kontrolu nasadenia (verzia z `pyproject.toml`) |
| POST | `/api/join` | verejné | `{code}` → nastaví cookie skupiny alebo admina, vráti rolu |
| GET | `/api/state` | skupina | Celý stav, s `ETag` podľa `version` |
| POST | `/api/assign` | skupina | `{night, slots[], party_id}`: zapíše partiu na voľné miesta, buď všetky, alebo žiadne. Partia musí byť v tú noc prítomná |
| POST | `/api/assign-stay` | skupina | `{slots[], party_id}`: to isté pre všetky noci pobytu. Každá noc je buď celá, alebo žiadna: noci, kde niektoré z miest nie je voľné, vynechá a vráti v `skipped` |
| POST | `/api/clear` | skupina | `{night, slot}`: uvoľní miesto |
| POST | `/api/move` | skupina | `{party_id, from_slot, to_slot, nights[]}`: presun buď celý, alebo nič |
| POST | `/api/parties` | skupina | Vytvorí partiu |
| POST | `/api/places` | skupina | `{party_id, night, places}`: nastaví počet potrebných miest partie v tú noc (pole `places`). Plný počet pole pre tú noc zmaže |
| PUT | `/api/parties/{id}` | skupina | Upraví partiu. Pri skrátení pobytu uvoľní miesta v nociach mimo pobytu a vráti ich v `freed` |
| DELETE | `/api/parties/{id}` | admin | Fáza 2. Zmaže partiu a uvoľní jej miesta |
| POST | `/api/admin/signup` | admin | Fáza 2. `{open}`: otvorí alebo zamkne zápis |
| GET | `/api/admin/export` | admin | Fáza 2. Stiahne `cabin-data.yaml` |

Pri zamknutom zápise vracajú zápisové akcie `signup_closed`, okrem požiadaviek s admin cookie.

### Kódy a cookies

- `GROUP_CODE` a `ADMIN_CODE` sú v premenných prostredia a porovnávajú sa cez `secrets.compare_digest`.
- Cookie je podpísaná kľúčom `SECRET_KEY` (`itsdangerous`), `HttpOnly`, `Secure`, `SameSite=Lax`. Skupina 30 dní, admin 12 hodín.

### Konzistencia

Každá zápisová akcia pod zámkom načíta aktuálny stav, overí podmienky funkciami z `validate.py`, zapíše, zvýši `version`, zapíše audit a vráti nový stav. Kontroly bežia vždy na serveri. Stránka ich môže robiť dopredu kvôli rýchlejšej odozve, ale nespolieha sa na ne.

### Chybové kódy

`bad_code` (401), `forbidden` (403), `signup_closed` (403), `slot_taken` (409), `not_present` (409), `duplicate_name` (409), `unknown_slot` (404), `unknown_party` (404), `invalid` (422), `rate_limited` (429). Každá chyba má anglickú `message` pre vývojára a podľa potreby `params`. Slovenský text pre používateľa vytvára stránka podľa `code`.

## Stránka: jedna scéna a interakcie

Stránka je jediná pixelová scéna (SVG). Všetko, čo sa používateľ dozvie, je nakreslené v nej, vo vlastnom pixelovom štýle (tabuľky a dosky z dreva, drobné ikonky). Mimo scény sú iba panely, ktoré sa na ňu vysúvajú, a obrazovka s kódom.

### Prvé otvorenie

1. Obrazovka s poľom na kód skupiny, v rovnakom štýle ako scéna. Po overení cez `POST /api/join` server nastaví cookie skupiny a stránka načíta `/api/state`.
2. Panel „Kto si?“: zoznam partií a tlačidlo **Pridať partiu**. Vybraná partia sa uloží ako *moja partia* do `localStorage`. Dá sa kedykoľvek zmeniť ťuknutím na tabuľku „Si: …“ v scéne.

### Informácie v scéne

Scéna má voľné trávnaté plochy, na ktorých sú tieto prvky. Ich pozície sú v `config/cabin.yaml` (kľúč `map.scene`), predvolene vpravo hore a vpravo dole podľa príkladu v sekcii Rozloženie chaty.

- **Tabuľa s názvom:** názov akcie z `/api/state`, nič napevno v kóde. Termín na tabuli nie je, lebo každý smerovník má svoj dátum; čítačka ho prečíta v popise tabule.
- **Tri smerovníky nocí:** Št → Pi, Pi → So, So → Ne a pod každým jeho dátum, napríklad „29./30. 10.“. Dátum je na smerovníku vždy. Zvolená noc je zvýraznená. Na každom je „obsadené X z 20“. Keď je vybratá moja partia, pod dátumom je na smerovníku štítok „máš 2/3“ (umiestnení z potrebných miest): červený s výkričníkom, keď miesta chýbajú, oranžový, keď ich je viac, zelený, keď sedia, a „nie si tu“, keď partia v tú noc nie je na chate. Ťuknutie prepne noc, v ktorej mapa ukazuje postavičky. Každý smerovník má výšku aspoň 44 px na obrazovke.
- **Nástenka s návodom:** 4 očíslované kroky po slovensky v poradí, v akom ich ide priateľ: „1. Pridaj svoju partiu.“, „2. Vyber, za ktorú partiu si.“, „3. Ťukni na posteľ a zapíš sa.“, „4. Skontroluj všetky tri noci.“ Na prvé otvorenie je rozbalená, potom sa zbalí na ikonku „?“, ktorou sa dá vrátiť.
- **Tabuľka partií:** keď je návod zbalený na „?“, pod smerovníkmi je papierová tabuľka so všetkými partiami: riadok je partia (farebný štvorček a meno, dlhé mená skrátené), stĺpce sú tri noci a v každej bunke je počet miest partie z potrebných, napríklad „2/3“. Keď miesta chýbajú, bunka je červená s výkričníkom, keď ich je viac, oranžová, a „–“ znamená, že partia v tú noc nie je na chate. Riadok mojej partie je žltý a stĺpec zvolenej noci má žltú hlavičku. Ťuknutím na tabuľku sa otvorí „Kto je kto“.
- **Tabuľka s partiou a stavom:** „Si: Ivan a Eva“ (ťuknutím sa mení), čas posledného načítania („aktualizované pred 20 s“) a upozornenie. Keď mojej partii v niektorej noci chýba miesto, ukáže sa výrazná červená ceduľa s výkričníkom, napríklad „V sobotu ti chýba 1 miesto“, a ťuknutím na ňu sa zvolí táto noc. Keď má partia v niektorej noci viac miest, než potrebuje, ukáže sa jemná oranžová poznámka, napríklad „Máš o 1 miesto viac, než potrebuješ“ (server to neodmieta). Keď je všetko v poriadku, ukáže sa zelená značka „Všetko máš“. Keď je noc červenej cedule už zvolená, ťuknutie na ceduľu otvorí panel s názvom dňa. Ak partia v tú noc už má aspoň jedno miesto, panel ponúkne tlačidlo napríklad „Vo štvrtok nás viac nebude“ (deň podľa začiatku noci) a „Ešte hľadám posteľ“. Ak nemá žiadne, ponúkne „Upraviť príchod a odchod“. Ťuknutím na „… nás viac nebude“ sa potrebný počet v tú noc nastaví na počet už zabraných miest (`places`), takže zmizne upozornenie, postavičky na lúke aj červený štítok na smerovníku. Postavičky na lúke, „Kto je kto“ a Prehľad na poslanie vždy rátajú s počtom potrebných miest v danú noc. Červená ceduľa vyzerá ako tlačidlo (dvojriadkový text „Št: chýbajú 2“ a „Ťukni sem ›“, reliéf, jemne blikajúci výkričník) a ťuknúť sa dá aj na postavičky na lúke. Keď má zvolená noc znížený počet a nič nechýba, ceduľa je zelená („Št: len 1 z 3 ›“) a ťuknutím sa otvorí panel s tlačidlom „Vo štvrtok prídeme všetci“, ktorý vráti plný počet.
- **Zamknutý zápis (fáza 2):** keď je `signup_open` false, v scéne je ceduľa „Zápis je zatvorený“ a miesta sa dajú len prezerať.
- **Prehľad na poslanie:** malá ikona listu v scéne otvorí panel s textom do WhatsAppu a tlačidlom **Kopírovať**. Text vyrába čistá funkcia: názov a termín, pre každú noc izby s menami partií a na konci upozornenia na partie s chýbajúcimi miestami a odkaz na stránku.
- **Kto je kto:** malá tabuľka s farebnými štvorčekmi v scéne otvorí panel so zoznamom partií: farba postavičky, meno, počet ľudí a príchod a odchod a miesta po nociach („Št → Pi 2/3“). Je len na pozeranie, partiu si vyberáš v „Kto si?“.
- **Admin (fáza 2):** po zadaní admin kódu sa v scéne objaví ikona kľúča, ktorá otvorí panel (zámka zápisu, export, zmazanie partie).

### Mapa

Vychádza z `podklady/mapa-nahlad.html`: pohľad zhora, tráva, chodníky, konica s podkrovím vľavo hore, dom s izbou vľavo, chodbou a izbou vpravo, letná kuchynka vľavo dole. Kreslí sa ako SVG so `shape-rendering="crispEdges"`, súradnice sú v konfigurácii (sekcia Rozloženie chaty).

- Obsadené miesto: postavička vo farbe partie (hlava a telo z pixelov). Deti zo stĺpca Deti sú menšie postavičky. Pri dlhom stlačení alebo prejdení myšou sa ukáže meno.
- Voľné miesto: biely štvorček, ktorý jemne bliká. Tesné miesto má oranžový štvorček. Pri `prefers-reduced-motion` bez blikania.
- Miesto mojej partie má pod postavičkou žltý rámik, aby ho človek hneď našiel.
- Ľudia mojej partie, ktorí v zvolenú noc ešte nemajú posteľ, stoja ako postavičky na lúke pri chodníku (`map.scene.meadow`), vo farbe partie, deti menšie. Deti, ktoré spia s rodičmi, nemajú vlastnú postavičku. Keď sa všetci nezmestia, na poslednom mieste je štítok „+N“. Postavičky iných partií na lúke nie sú. Keď si partia zaberie posteľ, postavička z lúky k nej pomaly a plynulo prejde (asi 3 s, na začiatku a na konci pomalšie). Cestou je stále plnofarebná, aj keď zápis ešte nepotvrdil server. V posteli ostane polopriehľadná, len ak server do príchodu ešte neodpovedal. Ak server odmietne zápis, postavička hneď zmizne a objaví sa späť na lúke (bez cesty späť). S `prefers-reduced-motion` sa objaví v posteli hneď.
- Ukladaná zmena je polopriehľadná, kým nepríde potvrdenie zo servera.
- Každá posteľ a každý smerovník, ceduľa či ikona je prvok s `role="button"`, `tabindex="0"` a popisom pre čítačky (napr. „Manželská posteľ, izba vľavo, v sobotu Ivan a Eva, 0 voľných“).
- Pre čítačky obrazovky je v stránke skrytý textový prehľad (izby, postele a mená pre zvolenú noc, termín, návod), aby sa dalo zistiť všetko aj bez kreslenia. Je to náhrada za samostatný zoznam.

### Ťuknutie na posteľ

Otvorí sa spodný panel s názvom postele a izbou, obsadením pre všetky tri noci a akciami:

- **Zapísať nás sem**: v zvolenú noc zaberie naraz toľko voľných miest v tejto posteli, koľko partii ešte chýba, najmenej jedno (`/api/assign` so `slots[]`). Pár tak manželskú posteľ obsadí jedným ťuknutím. Druhá voľba **Na všetky naše noci** volá `/api/assign-stay`.
- **Uvoľniť**: pri mieste mojej partie hneď, pri cudzej partii s potvrdením „Toto miesto má Riso a Ben. Naozaj ho uvoľniť?“.
- **Presunúť**: zapne režim presunu. Hore sa ukáže pruh „Ťukni na nové miesto pre Ivan a Eva“ s tlačidlom **Zrušiť**. Ťuknutie na voľné miesto zavolá `/api/move` pre zvolenú noc alebo pre všetky noci podľa prepínača v pruhu.

Ak partia v danú noc nie je na chate, akcia zapisovania je vypnutá a panel povie prečo, s odkazom na úpravu príchodu a odchodu.

### Formulár partie

Panel nad mapou. Polia partie z `cabin-data.yaml` (meno, dospelí, deti, deti spiace s rodičmi, príchod, odchod, čas príchodu, poznámka). Slúži na pridanie aj úpravu. Pri skrátení pobytu stránka vopred povie, ktoré miesta sa uvoľnia.

### Vzhľad

- Panely a obrazovka s kódom používajú písma Alegreya (nadpisy) a Alegreya Sans (text) z Google Fonts a tieto farby:
  - svetlý režim (jesenná paleta): `--bg:#EFE5D3; --surface:#FBF6EC; --surface2:#F4EBDB; --ink:#2B1D14; --muted:#6B5644; --line:#DCC9AE; --forest:#4A2C1A; --moss:#5E6B24; --amber:#96540F; --amber-soft:#F6DFB8; --warn:#A3361E; --warn-soft:#F6D6C8; --ok:#3F6E2C`
  - tmavý režim (podľa `prefers-color-scheme`): `--bg:#1A1410; --surface:#241C16; --surface2:#2D231B; --ink:#F1E7D9; --muted:#B9A38C; --line:#47382B; --forest:#F2DBB8; --moss:#B9C46F; --amber:#EDA94E; --amber-soft:#3F2C16; --warn:#F08C70; --warn-soft:#43241A; --ok:#93C67E`
  - Paletu a načítavaciu animáciu vybral product owner na základe delegovania organizátora (22. 10. 2026). Názov `--forest` ostal, hoci je to teraz tmavý gaštan.
- Scéna (mapa, tabule, smerovníky) má pevné farby a v tmavom režime sa neinvertuje. Text v scéne je pixelový alebo monospace, nie Alegreya.
- Jesenné farby scény: tráva `#8E9B48`, chumáčiky trávy `#76823A`, chodníky `#D6BC8E`, spadnuté lístie na tráve (len farba na pozíciách chumáčikov) `#B5532A`, `#D69A2E` a `#8E3424`. Farby izieb v `config/cabin.yaml` a 12 farieb partií ostávajú.
- Pri načítavaní stránka ukáže cez celú obrazovku veľký pixelový obrázok chaty v jesennej krajine (obloha, stromy, tráva, popadané lístie; iba farby scény, bez textu v obrázku) a text „Načítavam…“ na malej drevenej ceduľke. Obrázok stojí aspoň 1,5 s od otvorenia stránky. Potom sa rozpadne na pixely, ktoré ako lístie po krokoch padajú nadol von z obrazovky (spodné rady prvé), a pod nimi sa ukáže mapa; pád trvá asi 1,5 s. S `prefers-reduced-motion` obrázok stojí 0,8 s a potom zmizne bez pádu. Ak sa dáta načítavajú dlhšie, obrázok počká a padá hneď, ako prídu. Pri chybe načítania obrázok stojí a na ceduľke je „Nepodarilo sa načítať, skúšam znova…“. Obrazovka s kódom a chyba načítania sa ukážu hneď, bez čakania. Farby obrázka sú pevné, v tmavom režime sa nemenia.
- Paleta 12 farieb partií, server ju priraďuje pri vytvorení partie, ak si partia nezvolí vlastnú (rozhodnutie organizátora z 24. 10. 2026; vo formulári sú to farebné štvorčeky a „Vlastná farba“), v tomto poradí: `#2F7D6D, #D07A2B, #6D5BA8, #C08A1E, #3E6FB0, #9C4A7A, #5E8A2E, #8A6A4A, #2E8AA0, #C0603A, #7A7F2B, #A04848`.
- Každá postavička má na tričku prvé písmeno mena svojej partie, malým pixelovým písmom 3 × 5 (aj deti). Diakritika sa vynechá (Š → S), berie sa prvé písmeno alebo číslica mena, a keď v písme nie je, je tam bodka. Písmeno je tmavé alebo svetlé podľa toho, čo je na farbe partie lepšie vidieť. To isté písmeno je aj vo farebnom štvorčeku partie v „Kto je kto“.
- Tabuľka partií v scéne má pevné farby scény ako ostatné tabule (papier, tmavé písmo, červený a oranžový štítok ako na smerovníkoch) a v tmavom režime sa nemení. Písmo je malé, preto ju na mobile treba priblížiť alebo ťuknúť na ňu a pozrieť si čísla v „Kto je kto“.
- Na mobile scéna zaberá celú šírku, spodný panel sa vysúva zdola, všetky ovládacie prvky (postele, smerovníky, ikony, tlačidlá) majú aspoň 44 px.

## Rozloženie chaty

Rozloženie budov je podľa náčrtu organizátora: konica s podkrovím vľavo hore, dom (izba vľavo, chodba, izba vpravo) vpravo pod ňou, letná kuchynka vľavo dole. Rozmiestnenie postelí v izbách, dvere, okná a chodníky sú zatiaľ odhad z náhľadu. Preto je všetko v `config/cabin.yaml` a dá sa upraviť bez zásahu do kódu.

Súradnice sú v jednotkách SVG pre `viewbox` 380 × 412 a zodpovedajú náhľadu. `rect` je `[x, y, šírka, výška]`. Poradie izieb, postelí a slotov určuje aj poradie v zozname a v texte na poslanie.

```yaml
event:
  name: "Chata 29. 10. – 1. 11."
  arrive_days: ["2026-10-29", "2026-10-30", "2026-10-31"]
  leave_days:  ["2026-10-30", "2026-10-31", "2026-11-01"]
  nights:      ["2026-10-29", "2026-10-30", "2026-10-31"]

map:
  viewbox: [380, 412]
  paths:   [[240, 316, 16, 96], [60, 396, 196, 12], [84, 174, 12, 160], [96, 280, 24, 12]]
  doors:   [[218, 240, 4, 20], [264, 240, 4, 20], [238, 316, 20, 4], [80, 172, 20, 6], [80, 334, 20, 4]]
  windows: [[186, 196, 24, 4], [300, 196, 24, 4]]
  scene:                       # prvky s informáciami, rect = [x, y, šírka, výška]
    title:  [176, 10, 196, 30]   # názov akcie
    nights: [176, 46, 196, 58]   # tri smerovníky nocí
    notice: [176, 112, 196, 82]  # nástenka s návodom
    status: [278, 322, 94, 88]   # „Si: …“, aktualizácia, upozornenie (dva riadky po 44)
    locked: [16, 190, 62, 56]    # ceduľa „Zápis je zatvorený“
    letter: [128, 336, 44, 44]   # ikona listu, prehľad na poslanie
    key:    [184, 336, 44, 44]   # ikona kľúča, iba pre admina
    legend: [24, 264, 44, 44]    # ikona „Kto je kto“, legenda farieb partií
    parties: [176, 112, 148, 82] # tabuľka partií a ich miest po nociach (vidno ju, keď je návod zbalený)
    meadow: [112, 381, 124, 14]  # lúka, kde čakajú ľudia mojej partie bez postele

rooms:
  - id: konica-upper
    name: "Konica, podkrovie"
    rect: [10, 26, 152, 70]
    floor: "#D9B98A"
    beds:
      - { id: konica-upper-double, name: "Manželská posteľ", kind: bed2, rect: [28, 46, 44, 30],
          slots: [konica-upper-double-1, konica-upper-double-2] }
      - { id: konica-upper-single, name: "Jednomiestna posteľ", kind: bed1, rect: [118, 44, 24, 34],
          slots: [konica-upper-single-1] }
  - id: konica-lower
    name: "Konica, dole"
    rect: [10, 96, 152, 80]
    floor: "#C9A67A"
    beds:
      - { id: konica-lower-mats, name: "Matrace na zemi", kind: mats, rect: [24, 132, 124, 26],
          slots: [konica-lower-mat-1, konica-lower-mat-2, konica-lower-mat-3] }
  - id: left
    name: "Izba vľavo"
    rect: [118, 196, 102, 124]
    floor: "#E8D2A6"
    beds:
      - { id: left-double, name: "Manželská posteľ", kind: bed2, rect: [128, 220, 44, 30],
          slots: [left-double-1, left-double-2] }
      - { id: left-window, name: "Posteľ pod oknom", kind: bed1, rect: [186, 220, 24, 34],
          slots: [left-window-1] }
      - { id: left-cot-1, name: "Rozkladacie lehátko 1", kind: cot, rect: [130, 272, 20, 36],
          slots: [left-cot-1] }
      - { id: left-cot-2, name: "Rozkladacie lehátko 2", kind: cot, rect: [158, 272, 20, 36],
          slots: [left-cot-2] }
  - id: hallway
    name: "Chodbička"
    rect: [216, 196, 54, 124]
    floor: "#DCC59B"
    beds:
      - { id: hallway-sofa, name: "Rozkladací gauč", kind: sofa, rect: [226, 226, 32, 58],
          slots: [hallway-sofa-1, hallway-sofa-2], tight: [hallway-sofa-2] }
  - id: right
    name: "Izba vpravo"
    rect: [266, 196, 106, 124]
    floor: "#E8D2A6"
    beds:
      - { id: right-bunk-1, name: "Poschodová posteľ 1", kind: bunk, rect: [276, 220, 24, 42],
          slots: [right-bunk1-top, right-bunk1-bottom] }
      - { id: right-bunk-2, name: "Poschodová posteľ 2", kind: bunk, rect: [308, 220, 24, 42],
          slots: [right-bunk2-top, right-bunk2-bottom] }
      - { id: right-sofa, name: "Gauč (polonúdzový)", kind: sofa1, rect: [336, 272, 28, 36],
          slots: [right-sofa-1] }
  - id: kitchen
    name: "Letná kuchynka"
    rect: [10, 334, 100, 62]
    floor: "#CFD8DC"
    beds:
      - { id: kitchen-stove, name: "Na peci", kind: stove, rect: [22, 352, 56, 28],
          slots: [kitchen-stove-1, kitchen-stove-2], tight: [kitchen-stove-2] }
```

Spolu 20 miest, z toho 2 tesné. Pozície postavičiek v posteli sa počítajú podľa `kind` rovnako ako v náhľade (`bed2` dve vedľa seba, `bunk` hore a dole, `mats` tri v rade, `sofa` a `stove` dve). Server pri štarte overí, že ID slotov sú unikátne a že dáta v `cabin-data.yaml` odkazujú len na existujúce sloty. Ak mapa nesedí s realitou, organizátor upraví iba tento súbor a reštartuje službu.

## Fáza 2: zápis vlastnými slovami cez Claude API

Voliteľné rozšírenie, stavia sa až keď fáza 1 funguje. Nad mapou pribudne pole „Napíš, kedy prídeš a kde chceš spať“. Kamarát napíše vetu, ako by ju písal do WhatsAppu, a na mape uvidí návrh, ktorý potvrdí jedným ťuknutím.

### Priebeh

1. Stránka pošle `POST /api/ai/propose` s textom, `party_id` mojej partie (ak už existuje) a históriou rozhovoru (najviac 6 posledných správ, drží ju stránka).
2. `app/llm.py` zavolá Anthropic Messages API cez oficiálny Python SDK (`AsyncAnthropic`), model z `config/app.yaml` (predvolene `claude-haiku-5-5`), `max_tokens` 1000, timeout 30 s, 2 opakovania pri sieťovej chybe.
3. Kontext pre Clauda: dátumy akcie s dňami v týždni, zoznam postelí a slotov s ID z `cabin.yaml`, obsadenosť každej noci bez tejto partie, existujúci záznam partie a pravidlá (tesné miesto len pre dieťa alebo natesno, deti spiace s rodičmi nepotrebujú miesto, odpovedať stručne po slovensky a tykať).
4. Výstup je vynútený nástroj `propose_signup` (`tool_choice` na tento nástroj). Schéma sa generuje z Pydantic modelu: `action` (`propose` alebo `ask`), `reply` (text pre kamaráta), `party` (polia partie) a `sleeping` (noc → zoznam ID slotov).
5. Server návrh overí funkciami z `validate.py` a vráti ho stránke aj so zoznamom problémov. Keď neprejde, pošle chyby Claudovi späť ako `tool_result` s `is_error` a raz požiada o opravu.
6. Stránka ukáže `reply`, kartu so zhrnutím a polopriehľadné postavičky na navrhnutých miestach. Tlačidlá **Potvrdiť** a **Niečo zmeniť**.
7. Potvrdenie pošle `POST /api/ai/apply` s celým návrhom. Server ho pod zámkom znova overí a zapíše naraz (partia aj všetky miesta), so zdrojom `ai` v audite. Ak medzitým niekto zobral miesto, vráti `slot_taken` a stránka požiada o nový návrh.

Pri `ask` (chýba deň príchodu, nejasný počet ľudí) sa návrh neukáže, len otázka.

### Kľúč a náklady

- API kľúč z **osobného** účtu v Claude Console, nie z firemného predplatného. Predplatený kredit (minimum je 5 $), automatické dobíjanie vypnuté.
- Kľúč je iba v premennej prostredia `ANTHROPIC_API_KEY` (súbor `.env` mimo gitu), nikdy na stránke ani v YAML.
- Odhad: asi 0,001 $ na správu. Celá akcia vrátane testovania vyjde na desiatky centov, najviac okolo 2 $.
- Bez nastaveného kľúča sa fáza 2 vypne a pole na stránke sa nezobrazí.

### Ochrana

- Text kamaráta je pre Clauda iba údaj. Návrh sa môže týkať len partie z požiadavky a server odmietne miesta iných partií, takže ani text typu „vymaž Mareka“ nič nespôsobí.
- Denný strop volaní (`ai_per_day`, predvolene 200) a najviac 10 správ za minútu na klienta, počítané v pamäti procesu.
- Správa najviac 1000 znakov.
- Keď API zlyhá alebo je strop vyčerpaný, stránka napíše „Teraz to nejde, zapíš sa ťuknutím na mapu“.

## Bezpečnosť a limity

Úroveň zodpovedá súkromnej akcii pre kamarátov. Cieľ je, aby náhodný človek s odkazom nemohol nič meniť a aby sa každá zmena dala dohľadať a vrátiť.

- **Bez prihlasovania.** Kód skupiny ide do WhatsAppu, admin kód má iba organizátor. Ktokoľvek s kódom skupiny môže technicky presunúť kohokoľvek, preto stránka pri cudzom mieste žiada potvrdenie a všetko ide do `audit.yaml`.
- **Tajomstvá** iba v premenných prostredia (`GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY`, voliteľne `ANTHROPIC_API_KEY`), načítané z `.env` mimo gitu. V repozitári je `.env.example`.
- **Limity zápisu:** najviac 30 zápisov za minútu na klienta a 10 pokusov o kód za minútu na IP adresu, v pamäti procesu. Pri prekročení `rate_limited`.
- **Vstupy:** Pydantic modely s limitmi. Meno partie najviac 60 znakov, čas príchodu 60, poznámka 300, počty 0–20. Server orezáva medzery a odmieta prázdne meno a duplicitné meno bez ohľadu na veľkosť písmen.
- **Výstup v HTML:** všetok text od ľudí sa vkladá cez `textContent`, nikdy cez `innerHTML`.
- **HTTPS** cez reverzný proxy (Caddy alebo nginx). Uvicorn počúva iba na `127.0.0.1`.
- **Súbory:** `data/` nie je servírovaný ako statický priečinok a nie je v gite. Proces beží pod vlastným používateľom s právom zápisu iba do `data/`.

## Akceptačné kritériá a testovanie

### Fáza 1 je hotová, keď

- [ ] Organizátor podľa `README` na čistom serveri nastaví tajné hodnoty ako premenné prostredia (bez `.env`, ten je len na lokálny vývoj), spustí aplikáciu cez Docker (`docker compose`) a sprístupní ju cez Caddy alebo nginx s HTTPS.
- [ ] Kamarát na mobile zadá kód, vyberie alebo pridá partiu a jedným ťuknutím sa zapíše na voľné miesto v jednu alebo všetky noci.
- [ ] Zmena sa do 30 sekúnd ukáže na inom zariadení bez ručného obnovenia.
- [ ] Dvaja ľudia naraz ťuknú na to isté voľné miesto: jeden uspeje, druhý dostane hlášku, kto ho má, a mapa sa vráti do správneho stavu.
- [ ] Presun partie na iné miesto v jednej aj vo všetkých nociach prebehne celý alebo vôbec.
- [ ] Skrátenie pobytu uvoľní miesta v nociach mimo pobytu a stránka na to vopred upozorní.
- [ ] Po reštarte servera sú všetky dáta na mieste. Poškodený alebo neplatný YAML server nenaštartuje a vypíše zrozumiteľnú chybu.
- [ ] Každý zápis je v `audit.yaml` a pred každým zápisom vznikne záloha v `data/backups/`.
- [ ] Stránka funguje v Safari na iPhone a v Chrome na Androide, vo svetlom aj tmavom režime, a na desktope.
- [ ] Termín, smerovníky nocí s obsadením, návod a upozornenie pre moju partiu sú nakreslené v scéne a berú sa z `/api/state`.
- [ ] Text „Prehľad na poslanie“ a skrytý textový prehľad pre čítačky dávajú rovnaké údaje ako mapa.

### Fáza 2 je hotová, keď

- [ ] Z 15 vzorových správ (napr. „prídem v piatok poobede s Benom, v nedeľu ráno ideme, hocikde pri deťoch“) aspoň 13 vedie k správnemu návrhu alebo k zmysluplnej otázke.
- [ ] Potvrdený návrh sa zapíše naraz a zlý alebo zastaraný návrh sa nezapíše nikdy.
- [ ] API kľúč nie je v žiadnom súbore v repozitári ani na stránke.

### Testy

- **Backend:** pytest s `httpx.AsyncClient` nad aplikáciou a dočasným priečinkom `data/`. Pokryť kontroly vo `validate.py` (obsadené miesto, prítomnosť, presun, skrátenie pobytu, duplicitné meno), atomický zápis a zálohy, súbežné `assign` na to isté miesto cez `asyncio.gather` (práve jedno uspeje), cookies a limity.
- **Fáza 2:** `llm.py` so zameniteľným klientom (fake), testy bez volania API. Sada 15 vzorových slovenských správ na ručné overenie s reálnym modelom.
- **Logika stránky** (prítomnosť, potrebné miesta, upozornenia, text na poslanie, pozície postavičiek) v samostatných čistých funkciách, testovaná v Node bez prehliadača.
- **Ručný kontrolný zoznam** v `tests/manual.md` pre kroky, ktoré sa automaticky overiť nedajú: nasadenie, dve zariadenia naraz, mobilné prehliadače.

## Otvorené rozhodnutia

Claude Code ich nemá rozhodovať sám. Použije uvedenú predvolenú voľbu a na konci práce ich vypíše organizátorovi.

- [x] **Termín:** rozhodnuté organizátorom: 29. 10. 2026 (štvrtok) – 1. 11. 2026 (nedeľa), noci 2026-10-29, 2026-10-30, 2026-10-31. Dátumy a noci sú iba v `config/cabin.yaml`.
- [ ] **Skutočné rozloženie postelí, dverí a okien:** predvolene podľa náhľadu, organizátor pošle opravy.
- [ ] **Môže sa kamarát zapísať na noc, keď nie je na chate?** Predvolene nie (`not_present`), musí si najprv upraviť príchod a odchod.
- [ ] **Uzávierka zápisu:** vo fáze 1 sa zápis nezamyká. Vo fáze 2 predvolene iba ručne cez `/api/admin/signup`.
- [ ] **Umiestnenie na serveri:** predvolene uvicorn na `127.0.0.1:8010` a aplikácia v koreni vlastnej (sub)domény. Ak má bežať pod podcestou (napr. `/cabin/`), stránka musí používať relatívne cesty k API.
- [ ] **Stavať fázu 2 (admin, AI)?** Predvolene nie, kým organizátor nepotvrdí po vyskúšaní fázy 1.
- [ ] **Denné návštevy, počet „na jedlo“ (T-039):** predvolene pre deň D = dospelí + deti všetkých partií s `arrive ≤ D ≤ leave` (ráta sa deň príchodu aj deň odchodu) plus dospelí + deti denných hostí s D v `day_visits`. Deti v rodičovskej posteli sa rátajú, `places` sa ignoruje. Alternatíva: iba ľudia, čo spali predchádzajúcu noc (`arrive < D ≤ leave`), plus denní hostia.
- [ ] **Denné návštevy, dni bez hostí (T-039):** predvolene sa v „Prehľade na poslanie“ deň bez denného hosťa nevypíše a nemá ani počet „na jedlo“.
- [ ] **Denné návštevy, tabuľa „Cez deň“ v scéne (T-041):** predvolene pod dolným chodníkom (`map.scene.days: [16, 440, 220, 48]`, scéna sa zväčší na `viewbox: [380, 492]`), kreslí sa iba keď je aspoň jeden denný hosť, ťuknutie otvorí „Kto je kto“.
- [ ] **Denné návštevy, tabuľka partií v scéne (T-040):** predvolene v nej denní hostia nie sú (nemajú noci), sú v „Kto je kto“ a na tabuli „Cez deň“.
- [ ] **Denné návštevy, tabuľka „Si: …“ (T-037):** predvolene zelená „Prídeš len cez deň“ namiesto „Všetko máš“.
- [ ] **Denné návštevy, deti v rodičovskej posteli (T-036):** predvolene musí byť 0, inak `invalid` (`day_only_kids_in_bed`); formulár pri dennej návšteve pole skryje a pošle 0.
