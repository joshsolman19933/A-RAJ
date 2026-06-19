================================================================================
                    IMPLEMENTATION PLAN: A RAJ
================================================================================

Dokumentum célja: A GDD-ben leírt játék teljes implementációs terve,
fázisokra és sprintekre bontva, konkrét technikai döntésekkel.

Verzió: 1.1
Utolsó frissítés: 2026-06-19 (Phase 1 COMPLETE — lásd docs/PHASE_1_RETROSPECTIVE.md)

================================================================================
1. TECHNOLÓGIAI DÖNTÉS: "TS-Hive" Stack
================================================================================

  Réteg              | Választás                      | Indoklás
  -------------------|-------------------------------|---------------------------
  Backend            | Node.js (NestJS) + TypeScript  | Moduláris, skálázható, teljes TS
  ORM                | Prisma                        | ACID, Type-safe, Migrations
  Adatbázis          | PostgreSQL                    | ACID garancia – semmi nem tűnhet el
  Cache / Queue      | Redis + BullMQ                | Pontos időzítés (támadások, keltetés)
  Frontend           | Vue.js 3 (Composition API)    | Gyors, könnyű, Canvas támogatás
  CSS                | TailwindCSS                   | Gyors prototípus, sötét téma
  Valós idejű        | Socket.io                     | Támadások, chat, feromonok
  PWA                | VitePWA plugin                | Mobil-first, offline támogatás
  Container          | Docker + Docker Compose       | Könnyű deploy, skálázható
  Code sharing       | Monorepo (shared/)            | TS interfészek, formulák megosztása

Monorepo struktúra: `/shared` mappában osztozik a frontend és a backend
a TypeScript interfészeken, konstansokon és matematikai formulákon.

================================================================================
2. KULCS TECHNIKAI MEGOLDÁSOK
================================================================================

2.1 LAZY CALCULATION – Erőforrás optimalizáció
------------------------------------------------
NINCS cron job! Minden számítás akkor történik, amikor a játékos:
  - Belép a játékba
  - Megnyitja a kaptár nézetet
  - Mielőtt egy támadás beérkezik hozzá

Függvény: `updateHiveState(hiveId, targetTimestamp)`
  1. Fetch `Hive` DB-ből, ellenőrizd `lastUpdated`-et
  2. `deltaMs = targetTimestamp - lastUpdated`
  3. Számold ki a termelést az épületek alapján
  4. Frissítsd a `Biomassza`, `Víz`, `Hő` értékeket
  5. ATTRITION: Loop `UnitBatches`-en. Ha `targetTimestamp > batch.hatchedAt + lifespan`,
     töröld a batchet, add `(batch.count * cost * 0.1)` biomasszát vissza
  6. Mentsd az új állapotot, `lastUpdated = targetTimestamp`

2.2 HEXAGONÁLIS TÉRKÉP
------------------------------------------------
- Koordináta rendszer: Axial `(Q, R)`
- Távolság számítás: `(abs(A.q-B.q) + abs(A.q+A.r-B.q-B.r) + abs(A.r-B.r)) / 2`
- DB: `MapHex` tábla indexelve `q` és `r` mezőkön
- Viewport betöltés: `WHERE q BETWEEN x AND y AND r BETWEEN w AND z`

2.3 EGYSÉG ÉLETTARTAM (ATTRITION)
------------------------------------------------
Az egységeket NEM integerként tároljuk (pl. `savkopo: 200`).
Helyette `UnitBatch`-ekben tároljuk:
  `[ { type: 'SAV_KOPO', count: 50, hatchedAt: '2023-10-12T10:00:00Z' } ]`
Támadáskor mindig a legrégebbi batchekből vonunk le.

2.4 HARCRENDSZER
------------------------------------------------
- Támadás indításakor BullMQ job ütemezése:
  `BullQueue.add('combat', { attackerId, defenderId, army }, { delay: travelTime })`
- Végrehajtás:
  1. Zárold le mindkét kaptár DB sorát
  2. Futtasd `updateHiveState`-et a védőn `Date.now()`-ig
  3. Számold ki a támadó/védő erőket
  4. Alkalmazd a veszteségeket arányosan
  5. Számold ki a zsákmányolt nyersanyagot
  6. Ütemezd a visszautat (BullMQ job)
  7. Írd meg a `CombatReport`-ot, emitálj WebSocket eventet

2.5 FEROMON-NYOMOK
------------------------------------------------
- Egy feromon: hexa koordináták tömbje `[{q, r}, ...]` + `expiresAt`
- Frontend Canvas raycasteli az egér-drag mozgást hexákra
- WebSocket emit: `WSS_FEROMON_DRAW({path, type})`
- Szerver validálja a klán rangot, menti DB-be, broadcastolja a klán tagoknak
- Mozgási boost: backend ellenőrzi a mozgási vektor és a feromon átfedést,
  alkalmazza a -15% idő módosítót

================================================================================
3. IMPLEMENTÁCIÓS FÁZISOK
================================================================================

--------------------------------------------------------------------------------
PHASE 1: Minimum Viable Hive (MVP Core Loop)
--------------------------------------------------------------------------------
Cél: Autentikáció, PWA setup, kaptár építés, lazy erőforrás számítás.

  Sprint 1.1 – Projekt inicializálás
    - Monorepo létrehozása (shared/, backend/, frontend/)
    - Docker Compose: PostgreSQL + Redis
    - NestJS projekt inicializálás
    - Vue 3 + Vite projekt inicializálás
    - Shared típusok és konstansok definiálása
    - ESLint + Prettier + TypeScript konfiguráció

  Sprint 1.2 – Autentikáció & PWA
    - Prisma schema: User, Hive, Chamber
    - JWT alapú autentikáció (register, login, refresh)
    -  Session middleware
    - VitePWA plugin konfigurálása (manifest, theme_color, ikonok)
    - Mobil-first alap layout komponensek
    - RefreshToken SHA-256 hashelés + logout érvénytelenítés
    - Axios auto-refresh interceptor

  Sprint 1.3b – Seed & Tesztek (EXTRA)
    - Jest + ts-jest konfiguráció (ESM)
    - Seed fájl: 3 teszt user, 3 kaptár
    - 12 unit teszt az EngineService.updateHiveState()-hez

  Sprint 1.3 – Kaptár Core & Lazy Calculation
    - HiveController: GET /hive, POST /hive/upgrade
    - Lazy Calculation Engine: updateHiveState()
    - Nyersanyag termelés számítása
    - Hő egyensúly rendszer
    - Kaptár bővítési logika (kamra építés, szintlépés)

  Sprint 1.4 – Kaptár UI
    - HiveView.vue – sötét "húsos" UI
    - ResourceBar.vue – requestAnimationFrame alapú vizuális tickelés
    - Kamra kártya komponensek
    - Építési sor UI

--------------------------------------------------------------------------------
PHASE 2: The Hatching (Egységek & Attrition)
--------------------------------------------------------------------------------
Cél: Egység keltetés, mutációs háló, attrition logika.

  Sprint 2.1 – Unit System
    - Prisma: UnitBatch, Mutation modellek
    - AttritionService.ts – élettartam számítás
    - UnitFactory – egység statisztikák, költségek, élettartamok
    - Keltetési idő számítás (kamra szint alapján)

  Sprint 2.2 – Keltető Rendszer
    - HatcheryController: POST /military/hatch
    - BullMQ job: keltetés befejezése
    - UnitBatch létrehozása a keltetés végén
    - Hő fogyasztás ellenőrzése keltetés előtt

  Sprint 2.3 – Mutációs Háló
    - MutationController: POST /mutation/research
    - Mutációs fa logika (szinergiák, előfeltételek)
    - DNS Nektár kezelés
    - Új egységek feloldása mutációk által

  Sprint 2.4 – Sereg UI
    - Hatchery.vue – keltető felület
    - MilitaryOverview.vue – sereg áttekintés
    - MutationTree.vue – mutációs háló vizualizáció
    - AttritionCountdown.vue – élettartam visszaszámláló

--------------------------------------------------------------------------------
PHASE 3: World Map & Bloodshed (Térkép & Harc)
--------------------------------------------------------------------------------
Cél: Hexa térkép renderelés, csapatmozgás, harc szimuláció.

  Sprint 3.1 – Térkép Adatstruktúra & API
    - Prisma: MapHex, Movement modellek
    - Map seeding script (üres világ generálása)
    - MapController: GET /map/viewport
    - Viewport alapú hexa lekérés
    - Távolság és utazási idő számítás

  Sprint 3.2 – Térkép Renderelés
    - MapView.vue – HTML5 Canvas alapú hexa térkép
    - axialToPixel(q, r, size) – hexa rajzoló függvény
    - Kamera mozgatás (pan, zoom)
    - Kaptárak, hegyek, tavak vizuális megjelenítése
    - PvE fészkek ikonjai

  Sprint 3.3 – Mozgás & Támadás Rendszer
    - MovementController: POST /movement/send
    - BullMQ combat job ütemezése
    - CombatService.ts – harc szimuláció $transaction-ben
    - Támadás típusok: rablóhadjárat, ostrom
    - Sebzés típusok: tüskés (fizikai) vs. savas (épületromboló)

  Sprint 3.4 – Harc UI & Riportok
    - CombatReport.vue – harcjelentés megjelenítése
    - AttackPanel.vue – támadás indítása modal
    - AttackNotification.vue – villogó vörös képernyőszél
    - Beérkező támadás visszaszámláló

--------------------------------------------------------------------------------
PHASE 4: Swarm Mind & Feromons (Klánok & Valós idejű funkciók)
--------------------------------------------------------------------------------
Cél: Klánok, chat, feromon nyomok, valós idejű interakciók.

  Sprint 4.1 – Klán Rendszer
    - Prisma: Clan, ClanMember modellek
    - ClanController: CRUD műveletek
    - Klán rangok és jogosultságok
    - Belső feromon piac (nyersanyag csere)
    - Boly kaptár (közös fejlesztés)
    - Diplomácia: szövetség, hadüzenet, NAP

  Sprint 4.2 – WebSocket Infrastruktúra
    - NestJS @WebSocketGateway
    - JWT autentikáció socket kapcsolaton
    - Room-ok: klán, globális, privát
    - Event tipizálás (shared types)

  Sprint 4.3 – Feromon-Nyomok
    - Prisma: FeromonTrail modell
    - Canvas drag interakció a térképen (csak klán tiszteknek)
    - WSS_FEROMON_DRAW event kezelése
    - Feromon renderelés: izzó, pulzáló görbék
    - Mozgási boost számítás feromon átfedés esetén

  Sprint 4.4 – Chat & Közösségi Funkciók
    - Klán chat (Socket.io room alapú)
    - Privát üzenetek
    - Globális chat
    - Értesítési rendszer (WebSocket push)

--------------------------------------------------------------------------------
PHASE 5: Terjeszkedés & Rajzás
--------------------------------------------------------------------------------
Cél: Új Királynő képzése, rajzás, több kaptár kezelése.

  Sprint 5.1 – Királynő Képzés
    - QueenTrainingController
    - Magas szintű Keltető követelmény
    - Brutális nyersanyag költség (Biomassza + DNS Nektár + idő)
    - Királynő entitás létrehozása

  Sprint 5.2 – Rajzás Mechanika
    - Rajzás indítása üres hexára
    - Kísérő sereg hozzárendelése
    - Mozgás a térképen (sebezhető állapot)
    - Új kaptár aktiválása
    - Kísérő sereg "beépülése" (elvesztése)

  Sprint 5.3 – Multi-Hive Management UI
    - Kaptár váltó UI
    - Összesített erőforrás nézet
    - Rajzás animáció a térképen

--------------------------------------------------------------------------------
PHASE 6: Polish, PvE, Monetizáció & Launch
--------------------------------------------------------------------------------
Cél: PvE tartalom, prémium rendszer, optimalizáció, launch.

  Sprint 6.1 – PvE Rendszer
    - PvE fészkek a térképen
    - AI ellenfelek (statikus erősség)
    - PvE jutalmak: DNS Nektár, Biomassza
    - Fészek respawn mechanika

  Sprint 6.2 – Monetizáció
    - Prémium fiók kezelés
    - "Zselé" prémium valuta rendszer
    - Keltetési boost alkalmazása
    - Kozmetikai skinek a kaptárhoz
    - Fizetési integráció (Stripe)

  Sprint 6.3 – UI Polírozás
    - Organikus animációk (pulzáló vénák, kikelés)
    - Kamrák vizuális lüktetése
    - Átmenetek, hover állapotok
    - Reszponzív design finomhangolás
    - Accessibility alapok

  Sprint 6.4 – Launch Előkészítés
    - Performance optimalizáció
    - Load testing
    - CI/CD pipeline
    - Backup stratégia
    - Monitoring & Logging
    - Dokumentáció véglegesítése
    - Admin felület alapok

================================================================================
4. ADATBÁZIS SÉMA ÖSSZEFOGLALÓ
================================================================================

  Tábla            | Főbb mezők
  -----------------|---------------------------------------------------
  User             | id, username, passwordHash, premiumTier
  RefreshToken     | id, token (SHA-256 hash), userId, expiresAt
  Hive             | id, userId, q, r, biomass, water, heat, dnaNectar, lastUpdated
  Chamber          | id, hiveId, type, level
  UnitBatch        | id, hiveId, unitType, count, hatchedAt
  Mutation         | id, hiveId, mutationType, level
  MapHex           | q, r, type, ownerHiveId
  Movement         | id, attackerId, targetQ, targetR, payload, arriveAt
  CombatReport     | id, attackerId, defenderId, result, detailsJson
  Clan             | id, name, colorHex, description
  ClanMember       | id, clanId, userId, role
  FeromonTrail     | id, clanId, type, path, expiresAt
  QueenTraining    | id, hiveId, targetQ, targetR, status, escortJson

================================================================================
5. API VÉGPONTOK ÖSSZEFOGLALÓ
================================================================================

  Fázis  | Metódus | Útvonal                    | Leírás
  -------|---------|----------------------------|------------------------------
  1      | POST    | /auth/register             | Regisztráció
  1      | POST    | /auth/login                | Bejelentkezés (JWT + refresh token)
  1      | POST    | /auth/logout              | Refresh tokenek visszavonása
  1      | GET     | /hive                      | Kaptár állapot lekérése
  1      | POST    | /hive/upgrade              | Kamra építés/fejlesztés
  2      | POST    | /military/hatch            | Egység keltetés indítása
  2      | GET     | /military/units            | Saját egységek listája
  2      | POST    | /mutation/research         | Mutáció kutatás indítása
  2      | GET     | /mutation/tree             | Mutációs háló lekérése
  3      | GET     | /map/viewport              | Térkép viewport lekérése
  3      | POST    | /movement/send             | Támadás/mozgás indítása
  3      | GET     | /movement/active           | Aktív mozgások listája
  3      | GET     | /combat/reports            | Harcjelentések
  4      | POST    | /clan/create               | Klán létrehozása
  4      | POST    | /clan/join                 | Klánhoz csatlakozás
  4      | GET     | /clan/:id                  | Klán adatok
  5      | POST    | /queen/train               | Királynő képzés indítása
  5      | POST    | /queen/swarm               | Rajzás indítása

================================================================================
6. MONITORING & KARBANTARTÁS
================================================================================

- Minden fázis végén: Dokumentáció frissítése
- Minden sprint végén: Task lista frissítése (completed/in-progress)
- Code review minden PR után
- TypeScript strict mode végig
- PostgreSQL backup napi rendszerességgel
- Redis persistence bekapcsolása (AOF)
- BullMQ dashboard a queue-k monitorozásához
