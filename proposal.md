# Chata 29. 10. – 1. 11.: zadanie pre Claude Code

Oct 21, 2026 · @Lukas Votypka

## Cieľ a kontext

Postav malú webovú aplikáciu na rozdelenie spania na chate. Kamaráti si na pixelovej mape chaty sami vyberú, kto kde spí v ktorú noc. Organizátor vidí aktuálny stav bez prepisovania správ z WhatsAppu.

**Celá aplikácia je jedna stránka a tou je mapa.** Termín, návod, prepínač nocí aj stav zápisu sú nakreslené priamo v pixelovej scéne, takže je to minihra a infostránka v jednom. Žiadna samostatná hlavička, zoznam ani prehľadová stránka. Formuláre a potvrdenia sa otvárajú ako panely nad mapou.

**Akcia:** 29. 10. (štvrtok) – 1. 11. 2026 (nedeľa), tri noci: Št → Pi (29./30. 10.), Pi → So (30./31. 10.), So → Ne (31. 10./1. 11.). Asi 8 až 10 partií, 13 až 18 ľudí vrátane detí. Kapacita je 18 bežných a 2 tesné miesta.

**Ľudia** komunikujú cez WhatsApp skupinu a aplikáciu otvoria z odkazu na mobile. Nemajú účty a nechcú sa registrovať. Väčšina sa zapíše ťuknutím na mapu, niektorí to nechajú na organizátora.

**Prečo takto:** vlastný jednoduchý backend v Pythone (FastAPI) na organizátorovom serveri. Dáta sú v čitateľných YAML súboroch na disku, takže ich organizátor vie v núdzi opraviť v editore a zálohovať obyčajným kopírovaním. Žiadna databáza ani externé služby, okrem voliteľného Claude API vo fáze 2 a služby Twilio Verify na overenie telefónu cez SMS (rozhodnutie organizátora z 25. 10. 2026, sekcia Prihlásenie telefónom).

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
| `app/events.py` | Rozosielanie zmien cez Server-Sent Events: zoznam otvorených spojení v pamäti, `presence` podľa spojení, ping a zatvorenie pri vypnutí |
| `app/llm.py` | Fáza 2: volanie Clauda a nástroj `propose_signup` |
| `static/index.html` | Celá stránka: jedna pixelová scéna s termínom, návodom a stavom zápisu, panely nad ňou (formulár partie, „Kto si?“, prehľad na poslanie, admin) |
| `config/cabin.yaml` | Akcia, noci, izby, postele, sloty a súradnice pre mapu |
| `config/app.yaml` | Limity a nastavenia aplikácie |
| `data/` | `cabin-data.yaml`, `audit.yaml`, `seen.yaml`, `backups/`. Mimo gitu, vytvorí sa pri prvom štarte |
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

**Čítanie:** stránka pri otvorení zavolá `GET /api/state` a dostane celý stav ako JSON: konfiguráciu akcie a rozloženia, partie, obsadenie slotov a `version`. Potom otvorí jedno trvalé spojenie Server-Sent Events (`GET /api/events`, `EventSource`), cez ktoré server pošle hneď celý stav a potom po každom zápise kohokoľvek nový stav, pri zmene toho, kto je online, len údaje `presence`, a každých 20 s krátky `ping` (rozhodnutie organizátora z 25. 10. 2026, nahrádza obnovovanie každých 30 sekúnd). Zmena od iných sa tak ukáže asi do sekundy. Keď je karta skrytá alebo zatvorená, stránka spojenie hneď zatvorí a po návrate ho otvorí znova. Server partiu nechá online ešte 10 s po zatvorení jej posledného spojenia (rozhodnutie organizátora z 25. 10. 2026: zakryté okno alebo krátke prepnutie do inej aplikácie nikoho hneď neodhlási; čakanie je na serveri, lebo Safari na iPhone skrytú stránku hneď zmrazí). Keď `EventSource` chýba alebo sa spojenie asi 60 s nedá nadviazať (napríklad proxy, ktorý odpoveď zadržiava), stránka sa vráti k obnovovaniu `GET /api/state` každých 30 sekúnd a spojenie skúša znova každých pár minút. `GET /api/state` ostáva s `ETag` a `304` ako doteraz. Kto je online, sa určuje podľa otvorených spojení (sekcia Dáta v YAML, `data/seen.yaml`). WebSocket sa nepoužíva.

**Zápis:** `POST /api/…` s telom JSON (sekcia API). Odpoveď obsahuje výsledok a čerstvý stav, takže stránka nemusí čítať znova.

**Optimistické UI:** po ťuknutí sa zmena hneď ukáže na mape ako „ukladám“. Keď ju server odmietne, mapa sa vráti do stavu zo servera a zobrazí dôvod (napr. „Toto miesto si medzitým zobral Riso a Ben“).

**Jeden proces je podmienka:** zámok (`asyncio.Lock`), limity, otvorené spojenia SSE a rozhovory fázy 2 sú v pamäti procesu. YAML je jediný zdroj pravdy. Ručná úprava súborov je možná, ale iba pri zastavenej službe. Bežné opravy robí organizátor cez akcie s admin kódom.

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
backups_keep: 5000
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

### `data/seen.yaml`

Rozhodnutie organizátora z 25. 10. 2026: všetci vidia, kedy bola každá partia naposledy na stránke a kto je práve online. Stránka posiela v každej požiadavke hlavičku `X-Party-Id` s *mojou partiou* z `localStorage` a pri spojení SSE ten istý údaj v parametri `party` (`EventSource` nevie posielať hlavičky); bez vybranej partie ho neposiela a nič sa nezapíše. Server pri požiadavke s platnou cookie skupiny zapíše čas „naposledy videná“ iba pre existujúcu partiu, aj keď odpovedá `304`. Pri spojení SSE ho zapíše pri otvorení, pri každom `ping` a pri zatvorení (rozhodnutie organizátora z 25. 10. 2026).

```yaml
p-7f3k2a: "2026-10-25T19:02:11+02:00"
p-2m9qxd: "2026-10-25T18:40:03+02:00"
```

- Malý samostatný súbor, nie súčasť `cabin-data.yaml`. V pamäti procesu je vždy čerstvý čas, na disk sa zapisuje atomicky (ako dátový súbor) a najviac asi raz za minútu za partiu.
- Nezvyšuje `version`, nerobí zálohy ani záznam v `audit.yaml` a nepočíta sa do limitov zápisu.
- Údaje nie sú dôležité: chýbajúci alebo poškodený súbor server pri štarte nezastaví (začne s prázdnymi údajmi a zapíše varovanie do logu) a neznáme `id` partií zahodí.
- Rozhodnutie organizátora z 25. 10. 2026: online je partia, ktorá má otvorené aspoň jedno spojenie SSE, alebo (pre stránky, ktoré sa vrátili k obnovovaniu každých 30 s) bola videná za posledných 75 sekúnd. Partia je teda online hneď po otvorení stránky a prestane byť online hneď, keď zatvorí stránku alebo ju skryje (ak nemá iné spojenie ani nebola videná za 75 s).

### `data/audit.yaml`

Každý zápis sa pripíše ako samostatný YAML dokument (oddelený `---`): čas, akcia, partia, noc, slot, hodnota pred, hodnota po, zdroj (`map`, `form`, `admin`, `ai`) a anonymné ID klienta (náhodný reťazec z `localStorage`). Slúži na dohľadanie a ručné vrátenie zmien.

### Zápis bez poškodenia súboru

- Každé čítanie, úprava a zápis beží pod jedným `asyncio.Lock`.
- Atomický zápis: obsah do dočasného súboru v tom istom priečinku, `fsync`, potom `os.replace`.
- Pred každým zápisom kópia do `data/backups/` s časom v názve, ponechá sa posledných 5000 (`backups_keep`).
- PyYAML výhradne `safe_load` a `safe_dump` s `allow_unicode=True` a `sort_keys=False`, aby súbor ostal čitateľný.
- Pri štarte sa súbor overí cez Pydantic modely a proti `cabin.yaml` (neznámy slot, neznáma partia, noc mimo akcie). Pri chybe server nenaštartuje a vypíše, čo presne je zle. Prázdny alebo chýbajúci súbor sa vytvorí.

## HTTP API

JSON nad HTTP. Všetky cesty okrem `/`, statických súborov, `/api/health` a `/api/join` vyžadujú cookie skupiny. Admin akcie vyžadujú admin cookie. Stránka posiela v každej požiadavke hlavičku `X-Client-Id` (náhodný reťazec z `localStorage`) pre audit a limity a, keď je vybratá moja partia, hlavičku `X-Party-Id` pre údaje „naposledy videná“ (sekcia Dáta v YAML, `data/seen.yaml`). Spojenie SSE posiela tie isté údaje v parametroch `client` a `party`, s rovnakou kontrolou a dĺžkou ako hlavičky.

### Odpoveď

Úspech vracia `200` a `{"ok": true, "state": {…}}`. Chyba vracia vhodný stavový kód a rovnaký tvar s popisom:

```json
{ "ok": false, "error": { "code": "slot_taken", "message": "Slot already taken", "params": { "night": "2026-10-31", "slot": "left-double-1", "party_id": "p-7f3k2a", "party_name": "Riso a Ben" } }, "state": { … } }
```

- `code` je stabilný identifikátor chyby. Stránka ho mapuje na slovenskú hlášku cez tabuľku kódov v `static/index.html`, napríklad `slot_taken` → „Toto miesto má v sobotu už Riso a Ben.“ Hodnoty do hlášky berie z `params` (noc, slot, partia, pole formulára).
- `message` je krátky anglický popis pre vývojára a logy. Stránka ho používateľovi nezobrazuje.
- Pre neznámy `code` stránka ukáže všeobecnú hlášku „Niečo sa nepodarilo, skús to znova.“


`state` obsahuje `version`, `updated_at`, `signup_open`, `event` (noci, dni príchodu a odchodu), `layout` (z `cabin.yaml`), `parties` a `sleeping`. Rozhodnutie organizátora z 25. 10. 2026: `state` obsahuje aj `presence` s časom servera (`server_time`), časom „naposledy videná“ pre každú partiu (ISO, chýba = ešte nevidená) a zoznamom partií, ktoré sú online. Stránka z toho počíta, ako dávno to bolo, bez toho, aby verila hodinám v telefóne. `presence` sa neukladá do `cabin-data.yaml`.

### Endpointy

| Metóda | Cesta | Prístup | Čo robí |
| --- | --- | --- | --- |
| GET | `/` | verejné | `static/index.html` |
| GET | `/api/health` | verejné | `{ok: true, version}` na kontrolu nasadenia (verzia z `pyproject.toml`) |
| POST | `/api/join` | verejné | `{code}` → nastaví cookie skupiny alebo admina, vráti rolu |
| GET | `/api/state` | skupina | Celý stav, s `ETag` podľa `version` a údajov o tom, kto je online |
| GET | `/api/events?party=…&client=…` | skupina | Spojenie Server-Sent Events (rozhodnutie organizátora z 25. 10. 2026, sekcia Zmeny naživo) |
| POST | `/api/assign` | skupina | `{night, slots[], party_id}`: zapíše partiu na voľné miesta, buď všetky, alebo žiadne. Partia musí byť v tú noc prítomná |
| POST | `/api/assign-stay` | skupina | `{slots[], party_id}`: to isté pre všetky noci pobytu. Každá noc je buď celá, alebo žiadna: noci, kde niektoré z miest nie je voľné, vynechá a vráti v `skipped` |
| POST | `/api/clear` | skupina | `{night, slot}`: uvoľní miesto |
| POST | `/api/move` | skupina | `{party_id, from_slot, to_slot, nights[]}`: presun buď celý, alebo nič |
| POST | `/api/parties` | skupina | Vytvorí partiu |
| GET | `/api/session` | skupina | `{verified: [party_id…], sms_enabled}`: partie, ktoré má toto zariadenie overené telefónom (sekcia Prihlásenie telefónom) |
| POST | `/api/parties/{id}/login/start` | skupina | `{phone}`: keď sa číslo zhoduje s číslom partie, pošle SMS s kódom |
| POST | `/api/parties/{id}/login/verify` | skupina | `{phone, code}`: overí kód a pridá partiu do cookie partií |
| POST | `/api/parties/{id}/phone/start` | skupina + partia | `{phone}`: pošle SMS s kódom na nové číslo partie |
| POST | `/api/parties/{id}/phone/verify` | skupina + partia | `{phone, code}`: po správnom kóde uloží číslo k partii a pridá partiu do cookie partií |
| DELETE | `/api/parties/{id}/phone` | skupina + partia | Odstráni číslo partie, partia už nie je chránená |
| POST | `/api/logout` | skupina | `{party_id}`: odoberie partiu z cookie partií tohto zariadenia |
| POST | `/api/briefing` | skupina | `{party_id, step}`: zapíše, že partia otvorila zastávku „Pred cestou“ (sekcia Pred cestou). Ide aj pri zamknutom zápise |
| POST | `/api/food` | skupina | `{party_id, text}`: nastaví alebo zmaže text partie „Čo kto donesie“ (sekcia Pred cestou). Ide aj pri zamknutom zápise |
| POST | `/api/places` | skupina | `{party_id, night, places}`: nastaví počet potrebných miest partie v tú noc (pole `places`). Plný počet pole pre tú noc zmaže |
| PUT | `/api/parties/{id}` | skupina | Upraví partiu. Pri skrátení pobytu uvoľní miesta v nociach mimo pobytu a vráti ich v `freed` |
| DELETE | `/api/parties/{id}` | admin | Fáza 2. Zmaže partiu a uvoľní jej miesta |
| POST | `/api/admin/signup` | admin | Fáza 2. `{open}`: otvorí alebo zamkne zápis |
| GET | `/api/admin/export` | admin | Fáza 2. Stiahne `cabin-data.yaml` |

Pri zamknutom zápise vracajú zápisové akcie `signup_closed`, okrem požiadaviek s admin cookie.

### Zmeny naživo (`/api/events`)

Rozhodnutie organizátora z 25. 10. 2026: namiesto obnovovania každých 30 sekúnd posiela server zmeny cez Server-Sent Events.

- Bez platnej cookie skupiny vráti `401 bad_code` v JSON ako ostatné cesty. Inak odpovie `Content-Type: text/event-stream`, `Cache-Control: no-cache` a `X-Accel-Buffering: no`, bez kompresie.
- Hneď po pripojení pošle `retry:` (asi 3000 ms) a `event: state` s celým stavom (rovnaký tvar ako `state` z `/api/state`, vrátane `presence`).
- Po každom zápise (hneď po atomickom zápise súboru) pošle všetkým spojeniam `event: state` s novým stavom.
- Keď sa zmení, kto je online (prvé spojenie partie sa otvorí, posledné sa zatvorí, partia s obnovovaním vstúpi do 75 s okna alebo z neho vypadne), pošle `event: presence` iba s objektom `presence`. `version` sa nemení.
- Každých 20 s pošle `event: ping` s `{server_time}`, aby stránka vedela, že spojenie žije, a aby proxy nezatvoril nečinné spojenie.
- Každé spojenie drží najviac jeden čakajúci stav a jeden čakajúci `presence` (starší nahradí novší), takže pomalý telefón nezväčšuje pamäť.
- Najviac 4 spojenia na `client` a 200 spolu, inak `429 rate_limited`. Otvorenie spojenia sa nepočíta do limitu 30 zápisov za minútu.
- Pri vypnutí alebo reštarte servera sa všetky spojenia zatvoria, aby vypnutie nečakalo na otvorené spojenia. Prehliadač sa potom pripojí znova sám.

### Kódy a cookies

- `GROUP_CODE` a `ADMIN_CODE` sú v premenných prostredia a porovnávajú sa cez `secrets.compare_digest`.
- Cookie je podpísaná kľúčom `SECRET_KEY` (`itsdangerous`), `HttpOnly`, `Secure`, `SameSite=Lax`. Skupina 30 dní, admin 12 hodín.

### Konzistencia

Každá zápisová akcia pod zámkom načíta aktuálny stav, overí podmienky funkciami z `validate.py`, zapíše, zvýši `version`, zapíše audit a vráti nový stav. Kontroly bežia vždy na serveri. Stránka ich môže robiť dopredu kvôli rýchlejšej odozve, ale nespolieha sa na ne.

### Chybové kódy

`bad_code` (401), `forbidden` (403), `signup_closed` (403), `login_required` (403), `phone_mismatch` (403), `bad_sms_code` (401), `sms_unavailable` (503), `slot_taken` (409), `not_present` (409), `duplicate_name` (409), `unknown_slot` (404), `unknown_party` (404), `invalid` (422), `rate_limited` (429). Každá chyba má anglickú `message` pre vývojára a podľa potreby `params`. Slovenský text pre používateľa vytvára stránka podľa `code`.

## Stránka: jedna scéna a interakcie

Stránka je jediná pixelová scéna (SVG). Všetko, čo sa používateľ dozvie, je nakreslené v nej, vo vlastnom pixelovom štýle (tabuľky a dosky z dreva, drobné ikonky). Mimo scény sú iba panely, ktoré sa na ňu vysúvajú, a obrazovka s kódom.

### Prvé otvorenie

1. Obrazovka s poľom na kód skupiny, v rovnakom štýle ako scéna. Po overení cez `POST /api/join` server nastaví cookie skupiny a stránka načíta `/api/state`.
2. Panel „Kto si?“: zoznam partií a tlačidlo **Pridať partiu**. Vybraná partia sa uloží ako *moja partia* do `localStorage`. Dá sa kedykoľvek zmeniť ťuknutím na „Si: …“ v spodnej lište. Rozhodnutie organizátora z 25. 10. 2026: pri každej partii v zozname je „online“ alebo ako dávno tu bola („pred 5 min“, „pred 2 h“, „pred 3 d“), a „zatiaľ nevidené“, keď tu ešte nebola.

### Informácie v scéne

Scéna má voľné trávnaté plochy, na ktorých sú tieto prvky. Ich pozície sú v `config/cabin.yaml` (kľúč `map.scene`), predvolene vpravo hore a vpravo dole podľa príkladu v sekcii Rozloženie chaty.

- **Tabuľa s názvom:** názov akcie z `/api/state`, nič napevno v kóde. Termín na tabuli nie je, lebo každý smerovník má svoj dátum; čítačka ho prečíta v popise tabule.
- **Tri smerovníky nocí:** Št → Pi, Pi → So, So → Ne a pod každým jeho dátum, napríklad „29./30. 10.“. Dátum je na smerovníku vždy. Zvolená noc je zvýraznená. Na každom je „obsadené X z 20“. Keď je vybratá moja partia, pod dátumom je na smerovníku štítok „máš 2/3“ (umiestnení z potrebných miest): červený s výkričníkom, keď miesta chýbajú, oranžový, keď ich je viac, zelený, keď sedia, a „nie si tu“, keď partia v tú noc nie je na chate. Ťuknutie prepne noc, v ktorej mapa ukazuje postavičky. Každý smerovník má výšku aspoň 44 px na obrazovke.
- **Návod („?“):** v scéne je len ikonka „?“. Ťuknutím sa otvorí okno „Návod“ uprostred obrazovky so 4 očíslovanými krokmi po slovensky v poradí, v akom ich ide priateľ: „1. Pridaj svoju partiu.“, „2. Vyber, za ktorú partiu si.“, „3. Ťukni na posteľ a zapíš sa.“, „4. Skontroluj všetky tri noci.“ Okno sa samo neotvára. (Rozhodnutie organizátora z 24. 10. 2026.)
- **Tabuľka partií:** pod smerovníkmi je vždy papierová tabuľka o dvoch častiach (rozhodnutie organizátora z 24. 10. 2026). Časť „Noc“ (pixelový mesiac): riadok je partia (farebný štvorček a meno, dlhé mená skrátené), stĺpce sú tri noci a v každej bunke je počet miest partie z potrebných, napríklad „2/3“. Keď miesta chýbajú, bunka je červená s výkričníkom, keď ich je viac, oranžová, a „–“ znamená, že partia v tú noc nie je na chate. Časť „Cez deň“ (pixelové slnko): stĺpec je každý deň udalosti, riadok je partia, ktorá príde len na deň, a spodný tučný riadok „spolu na jedlo“ ukazuje počet ľudí na jedlo v každý deň (aj 0). Riadok mojej partie je žltý a stĺpec zvolenej noci má žltú hlavičku. Keď sa riadky nezmestia, každá časť skončí riadkom „+N ďalších“. Ťuknutím na tabuľku sa otvorí „Kto je kto“.
- **Spodná lišta (HUD):** „Si: Ivan a Eva“ (ťuknutím sa mení) s riadkom, kto je online, a vedľa nej stavová ceduľa mojej partie sú pevná drevená lišta dole na obrazovke mimo SVG, takže zostáva na mieste pri posúvaní aj priblížení mapy a scéna sa vmestí nad ňu (rozhodnutie organizátora z 24. 10. 2026). Keď mojej partii v niektorej noci chýba miesto, ceduľa je červená s výkričníkom, napríklad „Št: chýbajú 2“ a „Ťukni sem ›“; ťuknutím sa zvolí táto noc a keď je už zvolená, otvorí sa panel s názvom dňa. Ak partia v tú noc už má aspoň jedno miesto, panel ponúkne tlačidlo napríklad „Vo štvrtok nás viac nebude“ (deň podľa začiatku noci) a „Ešte hľadám posteľ“. Ak nemá žiadne, ponúkne „Upraviť príchod a odchod“. Ťuknutím na „… nás viac nebude“ sa potrebný počet v tú noc nastaví na počet už zabraných miest (`places`), takže zmizne upozornenie, postavičky na lúke aj červený štítok na smerovníku. Postavičky na lúke, „Kto je kto“ a Prehľad na poslanie vždy rátajú s počtom potrebných miest v danú noc. Ťuknúť sa dá aj na postavičky na lúke. Keď má partia v niektorej noci viac miest, než potrebuje, ceduľa je jemne oranžová („Máš o 1 miesto viac, než potrebuješ“; server to neodmieta). Keď má zvolená noc znížený počet a nič nechýba, ceduľa je zelená („Št: len 1 z 3 ›“) a ťuknutím sa otvorí panel s tlačidlom „Vo štvrtok prídeme všetci“, ktorý vráti plný počet. Keď je všetko v poriadku, je to zelená značka „Všetko máš“ bez ťuknutia. Rozhodnutie organizátora z 25. 10. 2026: riadok pod „Si: …“ už neukazuje „aktualizované pred …“, ale kto je online: „online:“ a malé farebné štvorčeky partií vrátane mojej, každý s písmenom ako na tričku postavičky, moja so žltým rámikom; najviac 6, zvyšok ako „+N“. Keď som online sám, je tam „online: len ty“ (štvorček by len opakoval erb vedľa), a „online: nikto“, keď nie je online nikto (rozhodnutie organizátora z 25. 10. 2026). Čas posledného načítania („aktualizované pred 2 min“) sa ukáže namiesto neho, iba keď je problém: spojenie SSE je v chybe alebo zo servera neprišla žiadna správa (stav, `presence` ani `ping`) dlhšie ako asi 45 sekúnd, keď je karta viditeľná; pri záložnom obnovovaní, keď posledné obnovenie zlyhalo alebo sú dáta staršie ako asi 90 sekúnd (rozhodnutie organizátora z 25. 10. 2026). Keď sa spojenie obnoví, riadok online sa vráti.
- **Úvodné priblíženie:** raz po načítaní stránky, hneď keď zmizne úvodný obrázok, mapa začne 2× priblížená na hornú časť scény (názov, smerovníky, tabuľka) a za 2,8 s sa plynulo oddiali na celú mapu, aby bolo vidieť, že sa dá posúvať a približovať. Prvý dotyk, koliesko alebo kláves na mape, zmena veľkosti okna alebo režim presunu ho zastaví tam, kde je. Otvorený panel ho nezastaví: nový návštevník, ktorému sa hneď po úvodnom obrázku otvorí „Kto si?“, vidí, ako sa mapa za polopriehľadným pozadím panela oddiali, a práve on ten náznak potrebuje. Pri `prefers-reduced-motion` sa nespustí. (Rozhodnutie organizátora z 24. 10. 2026.)
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

### Deň a noc pri prepnutí noci

Požiadavka organizátora z 26. 10. 2026 (náhľad `design/day-night/`, rozbor v `design/day-night/README.md`). Keď kamarát ťukne na smerovník inej noci, v scéne ubehne čas: každá noc sa ukazuje na poludnie dňa, keď začína (Št → Pi = štvrtok 12:00), a prepnutie zo Št → Pi na So → Ne pretočí čas zo štvrtka 12:00 na sobotu 12:00 cez súmrak, noc a svitanie dvakrát. Späť (So → Št) beží čas dozadu.

- Trvanie asi 0,9 s + 1,25 s za každých 24 hodín (jedna noc asi 2,2 s, dve noci asi 3,4 s), na začiatku a na konci pomalšie. Ťuknutie počas pretáčania pokračuje plynulo z aktuálneho času k novej noci.
- Slnko okolo 30. 10.: východ asi 06:40, západ asi 16:40, súmrak asi 1,2 h. Pri západe a východe scéna zoranžovie, v noci stmavne do tmavomodrej. Izby ostanú jemne osvetlené, okná a dvere svietia (súradnice z `layout.rooms`, `map.windows`, `map.doors`), na tráve blikajú svetlušky, vták v noci neletí.
- Smerovníky a tabuľka partií (vrstva tabúľ) ostanú čitateľné: stmavnú len mierne.
- **Posuvník času (rozhodnutia organizátora z 26. 10. 2026; druhé nahrádza pevnú lištu hore):** posuvník je nakreslený priamo v scéne medzi tabuľou s názvom akcie a smerovníkmi nocí, v obdĺžniku `map.scene.time` z `config/cabin.yaml` (rovnako široký ako smerovníky), takže sa posúva a približuje s mapou. Je to drevená koľajnička s tmavými úsekmi nocí a gombíkom s pixelovým slnkom alebo mesiacom podľa svetla; vedľa gombíka je papierový štítok s časom („Pi 22:00“), pri pravom konci sa preklopí na ľavú stranu gombíka. Koľajnička je rozdelená ako smerovníky: úsek každej noci leží presne nad jej smerovníkom (noc Št → Pi od štvrtka 12:00 po piatok 6:00, Pi → So od piatka 6:00 po sobotu 6:00, So → Ne od soboty 6:00 po nedeľu 12:00; medzery medzi smerovníkmi sú hranice o 6:00), takže gombík stojí vždy nad zvolenou nocou. Gombík sa dá chytiť na ploche aspoň 44 × 44 bodov (presahuje cez spodok tabule s názvom a vrch smerovníkov a má prednosť pred nimi), ťuknutie na koľajničku (aj trochu nad ňou) pretočí čas na to miesto. Ťahaním gombíka sa čas posúva plynulo, mapa sa pri tom neposúva a svetlo v scéne čas sleduje; keď sa pustí, čas ostane tam, kde je (aj v noci). Posuvník je vo vrstve tabúľ, nad svetelnou vrstvou, takže ostane čitateľný aj v noci. Pre čítačky je to `role="slider"` s hodnotou napríklad „piatok 03:00, noc Št → Pi“; šípky posúvajú o 1 hodinu, Page Up/Down o 6 hodín, Home/End na začiatok a koniec. Po načítaní stránky je čas na poludnie zvolenej noci. Pevná lišta hore sa ruší.
- **Ktorá noc patrí k času:** noc sa začína aj končí o 6:00 ráno. Čas od štvrtka 12:00 do piatka 6:00 je noc Št → Pi, od piatka 6:00 do soboty 6:00 noc Pi → So, od soboty 6:00 do konca (nedeľa 12:00) noc So → Ne. Keď posuvník alebo pretáčanie prejde cez 6:00, zvolí sa nová noc (zvýraznený smerovník, spodná lišta, panely) bez ďalšieho pretáčania.
- **Postavičky o 6:00:** keď čas prejde cez 6:00 do inej noci, ľudia, ktorí v tú noc v posteli spali, vstanú a zmiznú (krátko sa posunú z postele a vyblednú, asi 0,5 s) a do postelí sa hneď ukážu ľudia novej noci (vyblednutím, asi 0,5 s). Kto spí na tom istom mieste v obe noci, ostane ležať. Cez deň sú teda v posteliach ľudia noci, ktorá v ten deň večer začína, a na poludnie vidno, kto kde spí. V nedeľu ráno, po poslednej noci, nikto nevstáva a ľudia ostanú v posteliach až do konca posuvníka. Pri pretáčaní cez viac nocí (Št → So) sa postavičky vymenia pri každom prechode cez 6:00. Zvýraznenie smerovníka sa mení spolu s postavičkami.
- Pretáča sa len po ťuknutí na smerovník, na ceduľu „Ťukni sem“ v spodnej lište alebo na pásik posuvníka; smerovník a „Ťukni sem“ pretočia čas na poludnie danej noci. Načítanie stránky, výber „Kto si?“ a zmeny naživo noc prepnú bez pretáčania.
- S `prefers-reduced-motion` sa nič nepretáča (ťuknutie posunie čas hneď), postavičky sa vymenia bez vyblednutia a svetlušky neblikajú. Ťahanie posuvníka funguje aj tak.
- Server sa nemení. Výpočty (svetlo podľa hodiny, popis času, trvanie, chvíľa výmeny postavičiek) sú čisté funkcie v `static/js/logic-daynight.js` s testami v Node.

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
- Tabuľka partií v scéne (časti „Noc“ a „Cez deň“) a spodná lišta majú pevné farby scény ako ostatné tabule (papier, tmavé písmo, červený a oranžový štítok ako na smerovníkoch, drevo a papier lišty) a v tmavom režime sa nemenia. Písmo v tabuľke je malé, preto ju na mobile treba priblížiť alebo ťuknúť na ňu a pozrieť si čísla v „Kto je kto“.
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
    title:  [176, 4, 196, 28]    # názov akcie
    time:   [176, 34, 196, 12]   # posuvník času (koľajnička nad smerovníkmi)
    nights: [176, 48, 196, 58]   # tri smerovníky nocí
    notice: [176, 112, 196, 82]  # nástenka s návodom
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

## Pred cestou: informácie pre hostí

Rozhodnutie organizátora z 25. 10. 2026. Okrem zápisu na miesta stránka odovzdá hosťom, čo treba vedieť pred cestou: čo si zbaliť, na čom sa spí, že voda z kohútika nie je pitná, čo sa bude variť a aký je program. Organizátor potrebuje vedieť, ktoré partie si to prešli. Schválený vzhľad je v `design/info/index.html` (len podklad, neservíruje sa). Platí jeho pohľad „Dobrodružstvo“ a „Rýchly prehľad“; „Prezentácia“ a nástroje nad telefónom sú iba z návrhu.

### Obsah: `config/info.yaml`

Píše organizátor, server ho načíta pri štarte, overí Pydanticom a pošle stránke v `/api/state` ako `info` (rovnako ako rozloženie z `cabin.yaml`). Texty sú po slovensky, lebo sú to údaje od organizátora ako názvy izieb, nie hlášky servera. Rozhodnutie organizátora z 25. 10. 2026: celá sekcia sa dá vypnúť príznakom `enabled: false` v súbore (predvolene `true`); súbor sa aj tak overí. Premenná prostredia `INFO_ENABLED` (`true`/`false`) prebije príznak zo súboru; `compose.yaml` ju predvolene nastaví na `false`, takže na produkcii je sekcia vypnutá, kým ju organizátor nezapne, a lokálne a na skúšobnom serveri (premenná nenastavená) rozhoduje súbor. Chýbajúci súbor alebo `enabled: false` znamená, že funkcia je vypnutá (žiadna tabuľa v scéne, žiadne sledovanie). Chybný súbor server nespustí s presnou hláškou (neznáma ikona, prázdny zoznam, deň mimo udalosti).

```yaml
water:
  drinkable: false          # false → červené varovanie „Voda z kohútika nie je na pitie.“
  liters_per_day: 2
  bottle_liters: 1.5
pack:                       # ikona z pevnej sady na stránke + text
  - { icon: spacak, label: "Spacák" }
  - { icon: vankus, label: "Vankúš" }
sleep:
  - { icon: plachta, label: "Plachta na matrac", note: "matrace a postele sú bez obliečok" }
menu:
  - { day: "2026-10-29", meals: [{ when: "večer", what: "guláš z kotlíka" }] }
bring: "raňajky pre svoju partiu, niečo na opekanie a pochutiny alebo koláč"
program:
  - { icon: lampion, title: "Lampiónový sprievod", when: "So po zotmení", note: "vezmi lampión" }
```

Sada ikon je v kóde stránky (pixelové obrázky z návrhu: spacák, vankúš, papuče, mikina, bunda, topánky, uterák, hygiena, čelovka, lieky, nabíjačka, kocka, plachta, karimatka, fľaša, smerovník, lezenie, lopta, oheň, lampión, truhla, hrniec). Server pozná rovnaký zoznam názvov, aby neznámu ikonu odmietol pri štarte. Ukážkový súbor s obsahom z návrhu je v repozitári.

### Stránka

- **Vstup:** v scéne je drevená tabuľa s batohom (`map.scene.briefing`, predvolene `[296, 408, 56, 56]`). Kým moja partia nemá všetko prejdené, bliká nad ňou „!“. Pod tabuľou je počet partií, ktoré to majú prejdené, napríklad „6/9“. Raz po načítaní stránky, kým moja partia nemá všetko prejdené, sa nad spodnou lištou ukáže ponuka „Pred cestou · Čo si zbaliť, voda, jedlo a program ›“, ktorá sa dá zavrieť. Bez vybranej partie sa najprv otvorí „Kto si?“.
- **Dobrodružstvo (hlavný pohľad):** celá obrazovka s dvorom pri chate zhora (kreslený v kóde, pevná výzdoba, nie skutočná chata) a postavičkou vo farbe mojej partie. Päť zastávok v pevnom poradí: auto (`pack`, čo si zbaliť), studňa (`water`), ohnisko (`food`), smerovník (`program`), chata (`sleep`). Ďalšia zastávka bliká, má poskakujúcu šípku a veľkú menovku, ostatné majú malú menovku a navštívené zelenú ✓. Ťuknutím na zastávku postavička dôjde po chodníku a otvorí sa snímka zastávky (pixelový obrázok hore, text dole) cez celý dvor. Späť na dvor vedie „‹ Dvor“ vľavo hore a tlačidlo dole; ťuknutie na dvor pri otvorenej snímke ju iba zavrie. Tabuľa hore vždy povie, čo robiť. Dole sú ikony piatich zastávok (zafarbia sa po návšteve), „☰“ (rýchly prehľad) a tlačidlo „Choď: Studňa ›“. Po poslednej zastávke sa otvorí záver „Máš všetko, vidíme sa na chate!“ s tlačidlami „Na mapu postelí“, „Zoznam na zbalenie“ a „Prejsť dvor znova“.
- **Obsah zastávok:** podľa návrhu. Pri studni kalkulačka vody: ľudia a dni podľa mojej partie (dospelí + deti, počet nocí pobytu, pri dennej návšteve počet dní), dajú sa zmeniť, výsledok v litroch a fľašiach. Pri chate poznámka „Tvoje miesto: … pribaľ karimatku“, keď má moja partia v niektorú noc miesto v posteli druhu `mats` alebo `cot`. Pri ohnisku počty „na jedlo“ po dňoch z existujúceho výpočtu (T-039).
- **Zbaliť si ako zoznam úloh:** veci z `pack`, k nim vždy „Plachta na matrac“, „Balená voda“ a „Karimatka“ (iba pri `mats`/`cot`). Ťuknutím sa vec označí ako zbalená (zelená, ✓) a znova ťuknutím zruší. Ukazovateľ „Ťukni, čo už máš · 3 z 15“, pri všetkom „Všetko zbalené!“. Ukladá sa iba v `localStorage` telefónu, na server nejde.
- **Rýchly prehľad:** jedna stránka v štýle panelov (svetlý a tmavý režim): voda hore, zoznam na zbalenie so zaškrtávaním (ten istý stav ako v dobrodružstve), spanie, jedlo, program a tlačidlo „Kopírovať do WhatsAppu“. Otvára sa z „☰“ a z tabule.
- **Desktop (od 900 px):** dvor vľavo, snímka zastávky vpravo vedľa neho; kým nie je nič otvorené, vpravo je uvítanie so zoznamom zastávok (dajú sa ťuknúť). Rýchly prehľad v dvoch stĺpcoch.
- Animácie (chôdza, blikanie, stieranie) sú pixelové po krokoch; pri `prefers-reduced-motion` postavička preskočí hneď a nič nebliká. Zastávky sú prvky s `role="button"`, ovládateľné klávesnicou, s popisom pre čítačky. Všetok text z konfigurácie ide cez `textContent`.

### Obsah podľa organizátora a „Čo kto donesie“

Rozhodnutie organizátora z 25. 10. 2026 (porovnanie s inštrukciami z minulého roka).

- **Žiadne pevné vety o chate v kóde.** Úvodné vety zastávok (balenie, spanie, jedlo) sú v `config/info.yaml`, nie v kóde; pevná ostáva iba veta varovania pri nepitnej vode. Veta „Nákup na spoločné jedlá rozpočítame.“ sa ruší, náklady sa nerozpočítavajú.
- **Nové polia v `config/info.yaml`** (všetky voliteľné, chýbajúce sa nezobrazia):
  - `pack_intro`, `sleep_intro`, `food_intro`: úvodná veta zastávky.
  - `note` pri položke `pack` (napr. pri spacáku „Nemáš? Daj vedieť, požičiame.“), zobrazí sa pod vecou na snímke a v rýchlom prehľade.
  - `food_plan`: zoznam textov bez dátumu, čo sa varí spolu (napr. „grilovanie“, „mäso upečené v piecke“). `menu` po dňoch je voliteľné a môže chýbať.
  - `food_note`: voľný text pri jedle (napr. „Obchod je 15 minút, netreba robiť nákup na 4 dni.“).
  - `facilities: {have: [...], missing: [...]}`: čo na chate je a čo nie je. Ukáže sa na snímke Chata ako dva zoznamy „Na chate je“ (✓) a „Na chate nie je“ (✗, výrazne) a v rýchlom prehľade pri spaní.
  - `host_arrival`: kedy príde organizátor (napr. „Organizátor príde na chatu okolo 16:00.“), zobrazí sa na úvode dvora a v rýchlom prehľade hore.
- **Obsah:** jedlo si každý bežne donesie, varí sa spolu, organizátor kúpi niečo navyše; plán je grilovanie a mäso upečené v piecke; obchod je 15 minút; na chate je gril, piecka, sporák a teplá voda v kuchynke, nie je sprcha ani WC; spacák si donesie každý, kto nemá, dá vedieť; plachta na matrac podľa potreby; organizátor príde okolo 16:00. Vymyslený jedálniček po dňoch sa z ukážkového súboru odstráni.
- **„Čo kto donesie“:** každá partia môže napísať jeden voľný text, čo donesie alebo pripraví (napr. „donesieme pizza pec“). Uloží sa ako pole partie `food_note` v `cabin-data.yaml` (najviac 120 znakov po orezaní medzier, prázdny text pole zmaže) cez `POST /api/food {party_id, text}` bežnou cestou zápisu (audit `food`). Ide aj pri zamknutom zápise. Neznáma partia je `unknown_party`, dlhý text `invalid` s `reason` `too_long`. Na snímke Ohnisko je časť „Čo kto donesie“: zoznam partií s textom (farebný štvorček, meno, text cez `textContent`) a pre moju partiu pole s tlačidlom „Uložiť“ (bez vybranej partie tlačidlo „Vyber, kto si“). Ten istý zoznam je v rýchlom prehľade pri jedle a v „Prehľade na poslanie“ ako riadok „Čo kto donesie: …“, keď nejaký text je.

### Kto si to prešiel

- Keď je vybratá moja partia, stránka pri otvorení každej zastávky pošle `POST /api/briefing {party_id, step}`, `step` je `pack`, `water`, `food`, `program`, `sleep` alebo `list` (otvorený rýchly prehľad). Bez vybranej partie sa nič neposiela.
- Server to zapíše do `cabin-data.yaml` pod `briefing: {id partie: [kroky]}` cez bežnú cestu zápisu (zámok, `version`, záloha, audit `briefing`), takže zmena príde všetkým naživo. Krok, ktorý už je zapísaný, nič nezapíše a vráti `ok` so stavom. Zapisuje sa aj pri zamknutom zápise. Neznámy krok je `invalid`, neznáma partia `unknown_party`. Pri štarte sa `briefing` overí ako `sleeping` (neznáma partia alebo krok server nespustí).
- Partia *má prejdené*, keď má všetkých päť zastávok, alebo otvorila rýchly prehľad (`list`).
- Vidia to všetci (rovnako ako „naposledy videná“): v „Kto je kto“ má každá partia riadok „Pred cestou: ✓ prejdené“, „2 z 5“ alebo „ešte nie“, na tabuli v scéne je počet partií s prejdeným a „Prehľad na poslanie“ končí riadkom „Pred cestou ešte neprešli: …“, keď také partie sú.

## Prihlásenie telefónom (SMS)

Rozhodnutie organizátora z 25. 10. 2026. Partia si môže pridať telefónne číslo. Keď ho má, vybrať si ju v „Kto si?“ a meniť ju môže iba zariadenie, ktoré číslo overilo kódom z SMS. Partie bez čísla fungujú ako doteraz. Je to súčasť fázy 1 (nie admin nástroj).

### Čo je chránené

- Partia s číslom je *chránená*. Zápisy, ktoré sa jej týkajú, vyžadujú, aby toto zariadenie malo partiu v cookie partií, inak `403 login_required` s `params.party_id` a `params.party_name`: úprava partie (`PUT /api/parties/{id}`), `assign` a `assign-stay` s jej `party_id`, `clear` miesta, ktoré je jej, `move` s jej `party_id`, `places`, `food`, `briefing` a správa čísla. Admin cookie obchádza ochranu.
- Pozeranie mapy, tabuľky a „Kto je kto“ ostáva otvorené pre každého s kódom skupiny.
- Pravidlo je čistá funkcia vo `validate.py` (`check_party_access`), volaná pod zámkom pri každom zápise.

### Telefónne číslo

- Ukladá sa v `cabin-data.yaml` pri partii ako `phone` v tvare E.164 (`"+421905123456"`, v úvodzovkách). Vstup môže mať medzery, pomlčky, `00` alebo domácu `0` na začiatku; domáca `0` znamená predvolene Slovensko (`+421`). Normalizácia je čistá funkcia na serveri; neplatné číslo vráti `invalid` s `params.field = "phone"`.
- Číslo **nikdy** nejde do `/api/state`, do SSE, do auditu ani do logov v plnom tvare. `state` má pri partii iba `phone_hint` (posledné 3 číslice, napr. `"456"`), keď je partia chránená. Audit zapíše iba `phone_hint`.
- Číslo sa nepridáva cez formulár partie (`POST`/`PUT /api/parties`), ale cez `phone/start` a `phone/verify`. Uloží sa až po správnom kóde z SMS, takže preklep nikoho nezamkne a cudzie číslo sa nedá pridať bez toho telefónu. Pri novej partii sa pridanie čísla ponúkne hneď po vytvorení (zariadenie, ktoré partiu vytvorilo, ju môže meniť, kým číslo nemá).
- Zmena čísla je opäť `phone/start` + `phone/verify` z overeného zariadenia. Odstránenie čísla (`DELETE /api/parties/{id}/phone`) robí overené zariadenie alebo admin. Keď niekto stratí telefón, organizátor číslo odstráni admin cookie alebo v `cabin-data.yaml` pri zastavenej službe.

### Overenie cez SMS (Twilio Verify)

- Kód generuje, posiela a overuje Twilio Verify (kanál `sms`, `Locale=sk`, platnosť podľa služby, predvolene 10 min). Server volá REST API cez `httpx` (bez SDK), v module `app/sms.py` so zameniteľným klientom. Testy používajú falošného klienta, nikdy skutočné API.
- Premenné prostredia `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. Keď chýbajú, `sms_enabled` je `false`: pridanie čísla je skryté a endpointy SMS vracajú `503 sms_unavailable`. Chránené partie ostávajú chránené (admin môže číslo odstrániť). Pre skúšobný server a vývoj `SMS_FAKE=1` zapne falošného klienta, ktorý kód (vždy rovnaký `SMS_FAKE_CODE`, predvolene `123456`) iba zapíše do logu servera; na produkcii sa nepoužíva.
- `login/start`: číslo sa normalizuje a porovná s číslom partie (`secrets.compare_digest`). Pri nezhode `403 phone_mismatch` a SMS sa nepošle. `login/verify` a `phone/verify`: zlý alebo prepadnutý kód vráti `401 bad_sms_code`. Pri chybe Twilia `503 sms_unavailable` (podrobnosti iba v logu).
- **Limity SMS** (v pamäti, `config/app.yaml`): najviac 1 SMS za 60 s a 5 za hodinu na partiu, 10 za hodinu na IP adresu, 5 pokusov o kód za 10 min na partiu. Pri prekročení `rate_limited` s `params.retry_after` (sekundy). Overovanie kódu sa nepočíta do limitu 30 zápisov.

### Cookie partií

- Po správnom kóde server nastaví cookie `party_auth` (podpísaná `SECRET_KEY`, `HttpOnly`, `Secure`, `SameSite=Lax`, 30 dní) so zoznamom overených `party_id` a časom overenia pre každú. Jedno zariadenie môže mať overených viac partií.
- Overenie partie v cookie platí, iba kým sa nezmení jej číslo: server ukladá pri partii `phone_set_at` a overenie staršie ako `phone_set_at` neplatí.
- `GET /api/session` vráti `verified` (iba partie, ktoré stále existujú a sú chránené alebo boli overené) a `sms_enabled`. SSE stav je rovnaký pre všetkých, preto overené partie nie sú v `state`.

### Stránka

- **„Kto si?“:** pri chránenej partii je malý zámok. Ťuknutie na chránenú partiu, ktorú zariadenie nemá overenú, otvorí panel „Prihlás sa“: „Zadaj svoje telefónne číslo (končí na …456)“, tlačidlo „Poslať kód“, potom pole na 6-miestny kód (`inputmode="numeric"`, `autocomplete="one-time-code"`) a „Overiť“. Po úspechu sa partia vyberie ako *moja partia*. Odkaz „Poslať znova“ po 60 s.
- Keď je v `localStorage` vybraná chránená partia bez overenia (napr. číslo pribudlo neskôr alebo vypršala cookie), stránka po načítaní otvorí „Kto si?“ s panelom prihlásenia a „Si: …“ ukáže prázdny stav.
- **Formulár partie:** sekcia „Telefón“: bez čísla „Pridať telefón (na prihlásenie)“, s číslom „Telefón končí na …456“ a tlačidlá „Zmeniť“ a „Odstrániť“. Zobrazí sa iba pri `sms_enabled`.
- Akcie nad cudzou chránenou partiou (napr. ťuknutie na jej posteľ) stránka vopred neponúka; keď server vráti `login_required`, ukáže „Ivan a Eva si chránia zápis telefónom. Zmeniť ho môžu iba oni.“
- Slovenské hlášky pre nové kódy sú v `static/js/logic-errors.js`. Čistá logika (normalizácia čísla na zobrazenie, stav panela prihlásenia, odpočet „Poslať znova“) je v `logic-*.js` a testovaná v Node.

### Vypínateľné overovanie (prepínač v admin paneli)

Rozhodnutie organizátora z 26. 10. 2026. Overovanie cez SMS sa dá vypnúť a zapnúť v admin paneli, bez reštartu servera.

- **Stav** je `phone_verify` v `cabin-data.yaml` (ako `signup_open`), v `state` sa posiela ako `phone_verify`. Chýbajúca hodnota = zapnuté (doterajšie správanie).
- **Prepínač:** `POST /api/admin/phone-verify {on}` (admin), bežná cesta zápisu (`version`, záloha, audit `phone_verify`, zmena príde všetkým naživo). V admin paneli tlačidlo „Vypnúť overovanie cez SMS“ / „Zapnúť overovanie cez SMS“. Zapnúť sa dá iba pri `sms_enabled`, inak `503 sms_unavailable`.
- **Vypnuté = číslo je len kontakt.** Číslo sa uloží bez SMS (`PUT /api/parties/{id}/phone {phone}`, iba pri vypnutom overovaní, inak `403 forbidden`), zmeniť alebo odstrániť ho môže ktokoľvek s kódom skupiny. Partia s číslom **nie je chránená**: `check_party_access` pustí každého, „Kto si?“ neukáže zámok ani panel „Prihlás sa“. Číslo ani pri vypnutom overovaní nejde do `state`, SSE, auditu ani logov (iba `phone_hint`).
- **Formulár pri vypnutom overovaní:** sekcia „Telefón“ je vidieť aj bez `sms_enabled`, s poľom na číslo a textom, že slúži organizátorovi ako kontakt. Bez overenia sa nič neposiela.
- **Zapnuté** = doterajšie správanie: partie s číslom sú chránené a prihlasuje sa cez SMS. Čísla zadané pri vypnutom overovaní sa po zapnutí stanú chránenými; prihlásené zariadenia zostanú, iba ak sa prihlásili po poslednej zmene čísla.

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

- **Bez účtov.** Kód skupiny ide do WhatsAppu, admin kód má iba organizátor. Ktokoľvek s kódom skupiny môže technicky presunúť kohokoľvek, preto stránka pri cudzom mieste žiada potvrdenie a všetko ide do `audit.yaml`. Výnimka (rozhodnutie organizátora z 25. 10. 2026): partiu s telefónnym číslom mení iba zariadenie overené cez SMS (sekcia Prihlásenie telefónom).
- **Tajomstvá** iba v premenných prostredia (`GROUP_CODE`, `ADMIN_CODE`, `SECRET_KEY`, voliteľne `ANTHROPIC_API_KEY` a `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`), načítané z `.env` mimo gitu. V repozitári je `.env.example`.
- **Limity zápisu:** najviac 30 zápisov za minútu na klienta a 10 pokusov o kód za minútu na IP adresu, v pamäti procesu. Pri prekročení `rate_limited`.
- **Vstupy:** Pydantic modely s limitmi. Meno partie najviac 60 znakov, čas príchodu 60, poznámka 300, počty 0–20. Server orezáva medzery a odmieta prázdne meno a duplicitné meno bez ohľadu na veľkosť písmen.
- **Výstup v HTML:** všetok text od ľudí sa vkladá cez `textContent`, nikdy cez `innerHTML`.
- **HTTPS** cez reverzný proxy (Caddy alebo nginx). Uvicorn počúva iba na `127.0.0.1`. Proxy nesmie zadržiavať ani komprimovať `/api/events` (Caddy: bez `encode` na tejto ceste; nginx: `proxy_buffering off` a `proxy_read_timeout 1h`).
- **Súbory:** `data/` nie je servírovaný ako statický priečinok a nie je v gite. Proces beží pod vlastným používateľom s právom zápisu iba do `data/`.

## Akceptačné kritériá a testovanie

### Fáza 1 je hotová, keď

- [ ] Organizátor podľa `README` na čistom serveri nastaví tajné hodnoty ako premenné prostredia (bez `.env`, ten je len na lokálny vývoj), spustí aplikáciu cez Docker (`docker compose`) a sprístupní ju cez Caddy alebo nginx s HTTPS.
- [ ] Kamarát na mobile zadá kód, vyberie alebo pridá partiu a jedným ťuknutím sa zapíše na voľné miesto v jednu alebo všetky noci.
- [ ] Zmena sa asi do sekundy ukáže na inom zariadení bez ručného obnovenia (cez SSE; pri záložnom obnovovaní do 30 sekúnd).
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
- [x] **Denné návštevy, počet „na jedlo“ (T-039):** rozhodol organizátor 24. 10. 2026. Denný hosť sa rátá `adults + kids` v dňoch z `day_visits`. Partia s `arrive ≤ D ≤ leave` sa rátá ako dospelí + deti − `missing`, kde `missing` = potrebné miesta − miesta na danú noc (`places`). Deň D sa dotýka nocí D − 1 (ráno) a D (večer), ak ležia v pobyte; v deň príchodu platí len noc D, v deň odchodu len noc D − 1, a berie sa noc s menším `missing` (viac ľudí). Deti v rodičovskej posteli sa rátajú, výsledok nie je pod 0.
- [ ] **Denné návštevy, dni bez hostí (T-039):** predvolene sa v „Prehľade na poslanie“ deň bez denného hosťa nevypíše a nemá ani počet „na jedlo“.
- [x] **Denné návštevy, tabuľa „Cez deň“ v scéne (T-041):** nahradené rozhodnutím organizátora z 24. 10. 2026 (T-043, T-044): samostatná tabuľa a `map.scene.days` sa rušia, denní hostia sú v dolnej časti tabuľky partií.
- [x] **Denné návštevy, tabuľka partií v scéne (T-040):** nahradené rozhodnutím organizátora z 24. 10. 2026 (T-044): tabuľka má hornú časť „Noc“ a dolnú časť „Cez deň“ s dennými hosťami a riadkom „spolu na jedlo“.
- [ ] **Denné návštevy, tabuľka „Si: …“ (T-037):** predvolene zelená „Prídeš len cez deň“ namiesto „Všetko máš“.
- [ ] **Denné návštevy, deti v rodičovskej posteli (T-036):** predvolene musí byť 0, inak `invalid` (`day_only_kids_in_bed`); formulár pri dennej návšteve pole skryje a pošle 0.
- [ ] **Návod ako okno (T-042):** predvolene sa návod sám neotvorí ani pri prvej návšteve, iba ťuknutím na „?“. Stav zbalený/rozbalený sa ruší.
- [ ] **Miesto pre vyššiu tabuľku (T-043):** predvolene sa veľký dom, letná kuchynka, ich dvere, okná, chodníky, ikony listu a kľúča, stavová tabuľa a lúka posunú o 56 jednotiek nadol (zvislý chodník od konice sa o toľko predĺži), tabuľka partií má najviac `parties: [176, 112, 196, 136]` a scéna `viewbox: [380, 496]`. Konica ostáva.
- [ ] **Ikona „?“ (T-043):** predvolene vľavo pod ikonou „Kto je kto“, `map.scene.notice: [24, 316, 44, 44]`, lebo tabuľka teraz zaberá celú šírku pod smerovníkmi.
- [ ] **Tabuľka partií, časť „Cez deň“ (T-044):** predvolene sa kreslí vždy, aj bez denných hostí (hlavička so slnkom a riadok „spolu na jedlo“ pre všetky dni udalosti). Počet na jedlo podľa pravidla T-039, zobrazí sa aj 0.
- [ ] **Tabuľka partií, keď sa nezmestí (T-044):** riadky oboch častí majú pevnú výšku a tabuľka rastie po výšku `map.scene.parties`. Keď sa všetky nezmestia, časť „Cez deň“ dostane najmenej 2 riadky (ak má toľko hostí), zvyšok časť „Noc“. Časť, ktorej riadky sa nezmestia, má v poslednom riadku „+N ďalšie“.
- [ ] **Spodné menu (T-045):** predvolene je vidieť iba spolu s mapou (nie na obrazovke s kódom ani počas načítavania). Vľavo „Si: …“ s časom aktualizácie, vpravo stavová ceduľa. Panely sa vysúvajú ponad neho, tlačidlo „Celá mapa“ a hlášky sú nad ním.
- [ ] **Naposledy videná a online (T-049, T-050):** predvolene stránka posiela *moju partiu* v hlavičke `X-Party-Id` (bez vybranej partie sa nič nezapíše), údaje sú v `data/seen.yaml` (na disk najviac raz za minútu za partiu), online znamená videná za posledných 75 s. Riadok v spodnej lište ukazuje „online:“ a štvorčeky partií online vrátane mojej (farba a písmeno z trička, najviac 6, potom „+N“); keď som sám, „online: len ty“; bez nikoho online „online: nikto“. V „Kto si?“ je pri partii „online“, „pred X min“ (najmenej 1 min), „pred X h“, „pred X d“ alebo „zatiaľ nevidené“. Čas načítania sa ukáže namiesto riadku online, keď je problém so spojením (pozri Zmeny naživo nižšie).
- [ ] **Zmeny naživo cez SSE (T-051 až T-054):** rozhodnutie organizátora z 25. 10. 2026 je SSE namiesto obnovovania každých 30 s. Predvolené hodnoty: modul `app/events.py`, `ping` každých 20 s, `retry` 3000 ms, najviac 4 spojenia na klienta a 200 spolu (`rate_limited`), online = aspoň jedno otvorené spojenie alebo videná za 75 s, „aktualizované pred …“ po 45 s bez správy zo servera, záložné obnovovanie každých 30 s po 60 s bez spojenia a nový pokus o spojenie každé 3 minúty, pri skrytej karte sa spojenie hneď zatvorí a server partiu nechá online ešte 10 s (rozhodnutie organizátora z 25. 10. 2026).
- [ ] **Úvodné priblíženie (T-046):** predvolene mapa začne 2× priblížená na hornú časť scény (názov, smerovníky, tabuľka) a za 2,8 s sa plynulo oddiali na celú mapu. Raz po načítaní stránky, nie pri `prefers-reduced-motion`, a zastaví sa pri prvom dotyku.
- [ ] **Pred cestou, kto to vidí:** predvolene všetci (v „Kto je kto“, na tabuli a v „Prehľade na poslanie“), nie iba organizátor, lebo admin nástroje sú fáza 2.
- [ ] **Pred cestou, čo je „prejdené“:** predvolene všetkých päť zastávok alebo otvorený rýchly prehľad.
- [ ] **Pred cestou, obsah:** predvolene ukážkový obsah z návrhu v `config/info.yaml` (voda nepitná, 2 l na človeka a deň, jedlo, program); organizátor ho opraví.
- [ ] **Pred cestou, slovenský text zo servera:** obsah `config/info.yaml` posiela server stránke ako údaje od organizátora (ako názvy izieb); pravidlo „server neposiela slovenské hlášky“ sa týka chybových hlášok a ostáva.
- [ ] **„Čo kto donesie“:** predvolene jeden text na partiu (najviac 120 znakov), upraviť ho môže ktokoľvek s kódom skupiny (ako ostatné údaje partie), vidia ho všetci.
- [x] **Plán, nastavenia produkcie v súbore s premennými (T-069):** požiadavka organizátora z 25. 10. 2026, rozhodnutie podľa odporúčania (organizátor ho nechal na Claude). Nastavenia, ktoré sa líšia medzi produkciou a skúšobným serverom (zatiaľ `INFO_ENABLED`), sa na produkcii píšu do toho istého súboru ako tajomstvá, `/etc/cabin/secrets.env` (mimo projektu, `chmod 600`, `docker compose --env-file`), nie do `compose.yaml` a nie do `.env` vedľa neho. `compose.yaml` premennú iba odovzdá s poistkou `${INFO_ENABLED:-false}`. Dôvod: súbor už existuje, je mimo gitu aj priečinka projektu, takže ho `git pull` neprepíše a lokálny vývojový `.env` ho nemôže potichu prepísať. Zmena je len v dokumentácii (README časť 4, `.env.example`, `tests/manual.md`), kód sa nemení. Nasadenie na produkciu iba na výslovnú žiadosť organizátora.
- [ ] **Prihlásenie telefónom (SMS):** rozhodnutie organizátora z 25. 10. 2026: Twilio Verify, chránia sa zápisy partie s číslom, cookie partií 30 dní. Predvolené hodnoty: domáca `0` = `+421`; číslo sa pridáva iba po overení SMS; v `state` iba posledné 3 číslice; limity 1 SMS/60 s a 5/h na partiu, 10/h na IP, 5 pokusov o kód za 10 min; bez premenných Twilia je pridanie čísla skryté a `SMS_FAKE=1` zapisuje kód do logu (skúšobný server); stratený telefón rieši organizátor admin cookie alebo úpravou `cabin-data.yaml`; zmena čísla zruší staré overenia.
- [ ] **Vypínateľné overovanie (26. 10. 2026):** rozhodnutie organizátora: prepínač v admin paneli, vypnuté = číslo je len kontakt a partia nie je chránená. Predvolené: chýbajúce `phone_verify` = zapnuté; zapnúť sa dá iba so Twilio (alebo `SMS_FAKE`); pri vypnutom overovaní môže číslo ktokoľvek zmeniť, takže po zapnutí môže byť pri partii aj zlé číslo (opraví admin). Rozhodnutie organizátora z 26. 10. 2026: keď je overovanie zapnuté a SMS nefunguje (chýba Twilio alebo zlyhá), partie s číslom ostanú chránené a prihlásiť sa nedá; ochrana sa podľa dostupnosti SMS nevypína, rieši to admin vypnutím overovania.
- [ ] **Deň a noc pri prepnutí noci (26. 10. 2026):** predvolené podľa rozboru: smerovníky a tabuľka stmavnú len mierne; asi 2,2 s za noc; svetlušky áno, zvuky (sova, kohút) nie. Rozhodnutie organizátora z 26. 10. 2026: posuvník času je v scéne medzi názvom akcie a smerovníkmi (`map.scene.time`) a postavičky sa menia o 6:00 (cez deň sú v posteliach ľudia nasledujúcej noci, v nedeľu ostanú ležať). Predvolené: po pustení posuvníka čas ostane, kde je (aj v noci); posuvník sa po načítaní nastaví na poludnie zvolenej noci; ľudia vstávajú vyblednutím na mieste, nie chôdzou k dverám.
