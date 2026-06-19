================================================================================
                    PHASE & SPRINT TASK LIST: A RAJ
================================================================================

Dokumentum célja: Részletes, check-list jellegű feladatlista minden sprinthez.
Fejlesztés közben folyamatosan frissítendő.

Utolsó frissítés: 2026-06-19 (Sprint 2.4 kész — Phase 2 COMPLETE, Phase 2 retrospektív kész)
Státuszok: [ ] Todo, [~] In Progress, [x] Done

================================================================================
PHASE 1: Minimum Viable Hive (MVP Core Loop)
================================================================================

--- Sprint 1.1: Projekt inicializálás ---
[x] Monorepo létrehozása (shared/, backend/, frontend/)
[x] Docker Compose fájl: PostgreSQL + Redis
[x] NestJS projekt inicializálás (backend/)
[x] Vue 3 + Vite projekt inicializálás (frontend/)
[x] shared/constants.ts – Egység statok, élettartamok, költségek
[x] shared/math.ts – Hexa távolság, attrition formulák
[x] shared/types.ts – TypeScript interfészek
[x] ESLint + Prettier + TypeScript konfiguráció (flat config, NestJS Logger, no-explicit-any tisztítás)
[x] README.md elkészítése
[~] Husky pre-commit hookok (elhalasztva)

--- Sprint 1.2: Autentikáció & PWA ---
[x] Prisma inicializálás + User, Hive, Chamber, RefreshToken modellek
[x] PostgreSQL migráció futtatása
[x] AuthController: POST /auth/register (Prisma-alapú)
[x] AuthController: POST /auth/login (JWT kiadás, refresh token)
[x] AuthController: POST /auth/refresh (JWT refresh token rotáció)
[x] AuthController: POST /auth/logout (refresh token visszavonás)
[x] JWT Guard + Strategy
[x] PrismaModule + PrismaService
[x] VitePWA plugin telepítése és konfigurálása
[x] PWA manifest (theme_color: #1a0505, ikonok generálása)
[x] Alap layout: mobil-first, sötét téma
[x] AppShell komponens (header, navigáció placeholder)
[x] Axios auto-refresh interceptor (401 -> token frissítés)


--- Sprint 1.3b: Seed & Tesztek ---
[x] Jest telepítése + jest.config.ts ESM konfiguráció
[x] backend/prisma/seed.ts — 3 teszt user, 3 kaptár (alap, mid-game, lazy calc demo)
[x] EngineService unit tesztek (12 db): production, heat starvation, storage clamp, edge cases
[x] tsconfig.spec.json — külön tsconfig a teszt fájloknak

--- Sprint 1.3: Kaptár Core & Lazy Calculation ---
[x] HiveController: GET /hive (updateHiveState hívása)
[x] HiveController: POST /hive/upgrade (UpgradeChamberDto validációval)
[x] EngineService: updateHiveState(hiveId, targetTimestamp) – delta órák, erőforrás frissítés
[x] Nyersanyag termelés számítása (Gombakert, Gyökér-Szívó, Hőkamra)
[x] Hő egyensúly rendszer (termelés/fogyasztás, heat starvation, soft degradation)
[x] Storage kapacitás (Emésztő Verem storagePerLevel, alap 500)
[x] Kamra építési és fejlesztési logika (Prisma $transaction, atomi költségvonás)
[x] Erőforrás költségek validálása építés előtt (calculateBuildCost)
[x] Chambet limit ellenőrzés (MAX_CHAMBERS, maxLevel)
[x] Egység tesztek a lazy calculationra — 12 unit teszt az EngineService-hez (Jest)

--- Sprint 1.4: Kaptár UI ---
[x] HiveView.vue – fő kaptár nézet (kamra grid, építési menü, auto-refresh 30s)
[x] ResourceBar.vue – erőforrás kijelző (Biomassza, Víz, Hő, DNS Nektár)
[x] requestAnimationFrame vizuális tickelés (0.5s interval, storageCap computed)
[x] ChamberCard.vue – kamra kártya (statok, szint, fejlesztés gomb, költség előnézet)
[x] BuildQueue.vue – építési sor placeholder
[x] hive.store.ts – Pinia store (fetchHive, tickResources, recalcProductionRates, upgradeChamber)
[x] hive.service.ts – API service (GET /hive, POST /hive/upgrade)
[x] Organikus pulzáló háttér (CSS animáció)
[x] Reszponzív töréspontok (grid-cols-2 md:grid-cols-4, pb-20 md:pb-4)

================================================================================
PHASE 2: The Hatching (Egységek & Attrition)
================================================================================

--- Sprint 2.1: Unit System ---
[x] Prisma: UnitBatch modell (id, hiveId, unitType, count, hatchedAt, lifespan)
[x] Prisma: Mutation modell (id, hiveId, mutationType, level, @@unique)
[x] AttritionService.ts – élettartam ellenőrzés (hatchedAt + lifespan > targetTime)
[x] UnitFactory: egység statisztikák, költségek, élettartamok (hatchTimeMinutes hozzáadva)
[x] Keltetési idő számítás (kamra szinttől függően) — calculateHatchTime() shared/math.ts-ben
[x] Attrition integrálása az updateHiveState-be (biomass recovery + storage clamping)
[x] Bomlási nyersanyag visszatérítés (10%) — ATTRITION_BIOMASS_RETURN a UNIT_STATS.biomassCost alapján
[x] HiveService.getHive(): unitBatches + mutations include-olva és visszaadva

--- Sprint 2.2: Keltető Rendszer ---
[x] MilitaryController: POST /military/hatch (HatchDto: unitType + count @Min @Max1000)
[x] MilitaryService.hatchUnits(): instant hatch — resource validáció, $transaction
[x] Hő fogyasztás ellenőrzése (hive.heat >= totalHeatCost)
[x] Keltető kamra létezés ellenőrzése (ChamberType.HATCHERY)
[x] Queen kizárása a normál keltetőből
[x] GET /military/units — saját unitBatch-ek lekérése
[x] MilitaryModule regisztrálva az app.module.ts-ben
[x] calculateHatchTime() logolás az instant hatch-nél (BullMQ deferred)

--- Sprint 2.3: Mutációs Háló ---
[x] MutationController: POST /mutation/research (ResearchDto: mutationType)
[x] MutationController: GET /mutation/tree (annotated with researchedLevel + unlocksUnit)
[x] Mutációs fa logika: előfeltételek validálása (validatePrerequisites)
[x] Szinergia aktiválás: isSynergyActive — minden required mutation szint ellenőrzése
[x] Új egységek feloldása: getUnlockedUnits — összes aktív szinergia alapján
[x] DNS Nektár költség validálása (targetLevel * MUTATION_DNA_NECTAR_COST_PER_LEVEL)
[x] Max level ellenőrzés (node.maxLevel)
[x] Mutation rekord létrehozás/frissítés $transaction-ben (instant research, BullMQ deferred)
[x] MutationModule regisztrálva az app.module.ts-ben

--- Sprint 2.4: Sereg UI ---
[x] Hatchery.vue – keltető felület: unit selector, count slider (1-100), költség előnézet, canAfford
[x] MilitaryOverview.vue – sereg áttekintés batchenként, AttritionCountdown integrálva
[x] MutationTree.vue – mutációs háló: kártyák, kutatás gomb, előfeltételek, szinergia feloldás, progress bar
[x] AttritionCountdown.vue – élettartam visszaszámláló (1mp ticker, onUnmounted cleanup, auto-stop expired-nél)
[x] DNS Nektár kijelző (MutationView-ben)
[x] Üres állapot kezelése (nincs még sereg, nincs mutáció)
[x] military.service.ts + military.store.ts
[x] mutation.service.ts + mutation.store.ts
[x] MilitaryView.vue + MutationView.vue
[x] Router frissítve: /military, /mutations útvonalak
[x] AppShell navigáció: Sereg + Mutációk linkek hozzáadva

================================================================================
PHASE 3: World Map & Bloodshed (Térkép & Harc)
================================================================================

--- Sprint 3.1: Térkép Adatstruktúra & API ---
[x] Prisma: MapHex modell (kompozit kulcs: q, r, @@id([q, r]), type, hiveId?)
[x] Prisma: Movement modell (id, fromHiveId, attackType, targetQ, targetR, sentAt, arriveAt, units Json)
[x] Map seed script (50-radius, seeded PRNG, 3% PvE / 5% lakes / 10% mountains, hive marking)
[x] MapController: GET /map/viewport?qMin=&qMax=&rMin=&rMax= (max 50 span)
[x] MapService: getViewport bounding box query + hive include + orphaned HIVE normalizálás
[x] MapModule regisztrálva az app.module.ts-ben
[x] db:map-seed script hozzáadva a backend package.json-hez
[x] Hexa távolság számítás: shared/math.ts (hexDistance már létezett)
[x] Utazási idő számítás: shared/math.ts (calculateTravelTime már létezett)

--- Sprint 3.2: Térkép Renderelés ---
[ ] MapView.vue – HTML5 Canvas
[ ] axialToPixel(q, r, size) – hexa koordináta -> pixel
[ ] drawHex() – hexa rajzoló függvény
[ ] Kamera: pan (drag), zoom (scroll)
[ ] Kaptárak renderelése (pulzáló körök)
[ ] Hegyek, tavak, PvE fészkek renderelése
[ ] Földalatti/felszíni réteg váltás
[ ] Kattintás -> hexa kiválasztás -> kaptár info panel

--- Sprint 3.3: Mozgás & Támadás Rendszer ---
[ ] MovementController: POST /movement/send
[ ] BullMQ combat job ütemezése
[ ] CombatService.ts: resolveCombat() $transaction-ben
[ ] Tüskés vs. Savas sebzés számítás
[ ] Rablóhadjárat logika (nyersanyag lopás)
[ ] Ostrom logika (kamrák rombolása)
[ ] Visszaút ütemezése (túlélő egységek)
[ ] CombatReport generálása
[ ] GET /movement/active – aktív mozgások

--- Sprint 3.4: Harc UI & Riportok ---
[ ] CombatReport.vue – harcjelentés részletes nézet
[ ] AttackPanel.vue – támadás modal (cél, sereg kiválasztás)
[ ] AttackNotification.vue – bejövő támadás jelzés
[ ] Villogó vörös képernyőszél (CSS animáció)
[ ] Érkezési visszaszámláló a támadásokhoz
[ ] Térképes támadás animáció (mozgó pontok)

================================================================================
PHASE 4: Swarm Mind & Feromons (Klánok & Valós idejű funkciók)
================================================================================

--- Sprint 4.1: Klán Rendszer ---
[ ] Prisma: Clan, ClanMember modellek
[ ] ClanController: POST /clan/create
[ ] ClanController: POST /clan/join
[ ] ClanController: GET /clan/:id
[ ] Klán rangok: Vezér, Tiszt, Tag
[ ] ClanMember jogosultságok validálása
[ ] Belső feromon piac: POST /clan/trade
[ ] Boly kaptár: közös fejlesztés
[ ] Diplomácia: szövetség, hadüzenet, NAP

--- Sprint 4.2: WebSocket Infrastruktúra ---
[ ] NestJS @WebSocketGateway létrehozása
[ ] JWT autentikáció socket kapcsolaton
[ ] Socket room-ok: klán (clan_<id>), globális, privát
[ ] Event tipizálás shared/types.ts-ben
[ ] Reconnect logika (frontend oldalon)
[ ] Socket middleware: rate limiting

--- Sprint 4.3: Feromon-Nyomok ---
[ ] Prisma: FeromonTrail modell
[ ] Canvas drag interakció (csak Officer role)
[ ] Raycasting: egér koordináta -> hexa koordináta
[ ] WSS_FEROMON_DRAW event kezelés (backend)
[ ] Feromon mentés DB-be + broadcast klán tagoknak
[ ] Feromon renderelés: izzó Bezier görbék
[ ] Vörös (támadó) / Zöld (védő) feromon típusok
[ ] Mozgási boost számítás: feromon átfedés detektálás

--- Sprint 4.4: Chat & Közösségi Funkciók ---
[ ] Klán chat (Socket.io room: clan_<id>)
[ ] Privát üzenetek (Socket.io room: user_<id>)
[ ] Globális chat
[ ] Chat UI komponens (üzenetlista, input)
[ ] Chat parancsok (/w, /c, /g)
[ ] Értesítési rendszer (WebSocket push)
[ ] NotificationPanel.vue – értesítések listája

================================================================================
PHASE 5: Terjeszkedés & Rajzás
================================================================================

--- Sprint 5.1: Királynő Képzés ---
[ ] Prisma: QueenTraining modell
[ ] QueenController: POST /queen/train
[ ] Magas szintű Keltető követelmény ellenőrzése
[ ] Nyersanyag költségek: Biomassza + DNS Nektár
[ ] BullMQ job: képzés befejezése
[ ] Királynő entitás létrehozása (speciális UnitBatch)

--- Sprint 5.2: Rajzás Mechanika ---
[ ] QueenController: POST /queen/swarm
[ ] Cél hexa validálása (üres, elérhető)
[ ] Kísérő sereg hozzárendelése
[ ] Mozgás a térképen (Movement séma)
[ ] Sebezhető állapot: támadás esetén Királynő pusztulhat
[ ] Új kaptár létrehozása megérkezéskor
[ ] Kísérő sereg "beépülése" (törlés)
[ ] Rajzás animáció a térképen

--- Sprint 5.3: Multi-Hive Management UI ---
[ ] HiveSwitcher.vue – kaptárak közötti váltás
[ ] Összesített erőforrás nézet
[ ] QueenTrainingPanel.vue – Királynő képzés kezelő
[ ] SwarmTargetPicker.vue – célpont kiválasztás térképen
[ ] Rajzás állapot követés

================================================================================
PHASE 6: Polish, PvE, Monetizáció & Launch
================================================================================

--- Sprint 6.1: PvE Rendszer ---
[ ] PvE fészkek a térképen (MapHex type: 'PVE')
[ ] AI ellenfelek statikus erősséggel
[ ] PvE jutalmak: DNS Nektár, Biomassza
[ ] Fészek respawn timer
[ ] PvE harcjelentés (CombatReport séma)

--- Sprint 6.2: Monetizáció ---
[ ] Prisma: PremiumAccount, Transaction modellek
[ ] "Zselé" prémium valuta rendszer
[ ] Prémium fiók előnyök (építési sorok, szűrők)
[ ] Keltetési boost alkalmazása (-10% idő)
[ ] Kozmetikai skinek a kaptárhoz
[ ] PaymentProvider interfész
[ ] Stripe integráció (webhook kezelés)

--- Sprint 6.3: UI Polírozás ---
[ ] Organikus animációk (pulzálás, kikelés)
[ ] Kamrák vizuális lüktetése (teljesítmény optimalizált)
[ ] Hover állapotok, transitionök
[ ] Reszponzív finomhangolás
[ ] Accessibility: ARIA label-ek, billentyűzet navigáció
[ ] Loading skeleton screen-ek
[ ] Error boundary komponens

--- Sprint 6.4: Launch Előkészítés ---
[ ] Performance optimalizáció: DB indexek, cache strategy
[ ] Load testing (k6 / Artillery)
[ ] CI/CD pipeline (GitHub Actions)
[ ] PostgreSQL backup stratégia (pg_dump cron)
[ ] Redis persistence konfiguráció (AOF)
[ ] Monitoring: Prometheus + Grafana (opcionális)
[ ] Logging: Winston / Pino
[ ] Rate limiting a publikus endpointokon
[ ] Admin felület (alap)
[ ] Dokumentáció véglegesítése
[ ] Beta launch checklist

================================================================================
