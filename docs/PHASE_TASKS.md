================================================================================
                    PHASE & SPRINT TASK LIST: A RAJ
================================================================================

Dokumentum célja: Részletes, check-list jellegű feladatlista minden sprinthez.
Fejlesztés közben folyamatosan frissítendő.

Utolsó frissítés: 2026-06-19 (Phase 6 Retrospektív elkészült ✅)
Státuszok: [ ] Todo, [~] In Progress, [x] Done

Kapcsolódó retrospektívek:
  docs/PHASE_1_RETROSPECTIVE.md — MVP Core Loop tanulságai
  docs/PHASE_2_RETROSPECTIVE.md — The Hatching tanulságai
  docs/PHASE_3_RETROSPECTIVE.md — World Map & Bloodshed tanulságai
  docs/PHASE_4_RETROSPECTIVE.md — Swarm Mind & Feromons tanulságai
  docs/PHASE_5_RETROSPECTIVE.md — Terjeszkedés & Rajzás tanulságai
  docs/PHASE_6_RETROSPECTIVE.md — Polish, PvE, Monetizáció & Launch tanulságai

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
[x] MapView.vue – HTML5 Canvas (requestAnimationFrame render loop, onUnmounted cleanup)
[x] axialToPixel(q, r, size) – hexa koordináta -> pixel (shared/math.ts)
[x] pixelToAxial(px, py, size) – pixel -> hexa koordináta (shared/math.ts)
[x] drawHex() – hexa rajzoló függvény (flat-top, terrain fill, icon render)
[x] Kamera: pan (drag), zoom (scroll + buttons, 0.3-3x range)
[x] Kaptárak renderelése (pulzáló körök, 🏠 icon)
[x] Hegyek, tavak, PvE fészkek renderelése (⛰ 💧 👾 ikonok)
[x] Kattintás -> hexa kiválasztás -> info panel (koordináta, típus, kaptár név)
[x] Kamera automatikus pozícionálás a saját kaptárra (onMounted + watch)
[x] Debounce-olt viewport betöltés (200ms, 5-hex küszöb)
[x] Canvas resize kezelés (onResize, kezdeti méretezés)
[ ] Földalatti/felszíni réteg váltás (elhalasztva)

--- Sprint 3.3: Mozgás & Támadás Rendszer ---
[x] MovementController: POST /movement/send (SendMovementDto: attackType + targetQ + targetR + UnitSelectionDto[])
[x] CombatService: resolveCombat() egy $transaction-ben (atomikus egység kezelés, áldozatok, loot, kamra rombolás, movement törlés)
[x] Tüskés vs. Savas sebzés számítás (attackPhysical+attackAcid vs defensePhysical+defenseAcid power-ratio formula)
[x] Rablóhadjárat logika (RAID: carryingCapacity * 0.5 faktor, biomassza 60% / víz 30% / DNS 10% lopás)
[x] Ostrom logika (SIEGE: max 2 véletlen kamra rombolása, Queen kizárva, level-1=törlés, magasabb=decrement)
[x] Védő áldozatok alkalmazása RAID és SIEGE esetén is
[x] PvE fészek preset (50/20/40/15 statok, 200 bio/100 víz/10 DNS jutalom)
[x] Acid Gland védelmi bónusz (defensePerLevel * level)
[x] CombatReport generálása (id, attackerId, defenderId, losses, resourcesLooted?, chambersDestroyed?, isVictory)
[x] GET /movement/active – aktív mozgások lekérése
[x] MovementModule + CombatModule regisztrálva az app.module.ts-ben
[ ] BullMQ combat job ütemezése (elhalasztva – instant resolution, mint a többi szolgáltatás)
[ ] Visszaút ütemezése (túlélő egységek) (elhalasztva – instant resolution miatt nincs szükség rá)

--- Sprint 3.4: Harc UI & Riportok ---
[x] CombatReport.vue – harcjelentés részletes nézet (Teleport modal, veszteségek, zsákmány, kamrák, victory/defeat animáció)
[x] AttackPanel.vue – támadás modal (Teleport panel, célpont info, RAID/SIEGE toggle, unit slider-ek, hexDistance travel time)
[x] AttackNotification.vue – villogó képernyőszél CSS animáció (victory: amber glow, defeat: red double-pulse)
[x] MapView integráció: canAttackSelected (PVE_NEST + ellenséges HIVE), "Támadás" gomb az info panel-en
[x] MilitaryView integráció: aktív mozgások szekció (típus, cél, egységszám)
[x] movement.service.ts + movement.store.ts (sendAttack, screenFlash, combatReport modal state)
[x] frontend/src/lib/unit-labels.ts – közös unit név helper (getUnitName, getUnitNameShort)
[ ] Érkezési visszaszámláló (BullMQ deferred – instant combat miatt nem releváns)

================================================================================
PHASE 4: Swarm Mind & Feromons (Klánok & Valós idejű funkciók)
================================================================================

--- Sprint 4.1: Klán Rendszer ---
[x] Prisma: Clan modell (name @unique, description, colorHex, level)
[x] Prisma: ClanMember modell (@@unique userId, role: LEADER/OFFICER/MEMBER)
[x] Prisma: ClanDiplomacy modell (@@unique clanId+targetClanId, named relations)
[x] Prisma: ClanTrade modell (fromUser/toUser named relations, resourceType)
[x] ClanController: POST /clan/create (name 2-30 chars, colorHex #rrggbb, $transaction)
[x] ClanController: POST /clan/join (membership check, P2002 race-condition kezelve)
[x] ClanController: GET /clan/:id (clan + members lista)
[x] ClanController: POST /clan/leave (leader utolsó tagként disband, cascade delete)
[x] ClanController: POST /clan/promote (leader-only, demote+pomote $transaction-ben)
[x] Klán rangok: LEADER/OFFICER/MEMBER — promoteMember jogosultság ellenőrzéssel
[x] Belső feromon piac: POST /clan/trade (TOCTOU-védett $transaction, resourceType: BIOMASS/WATER/DNA_NECTAR)
[x] Diplomácia: POST /clan/diplomacies (upsert, leader/officer-only, ALLY/ENEMY/NAP/NEUTRAL)
[x] Diplomácia: GET /clan/diplomacies (targetClan info-val)
[x] ClanModule regisztrálva az app.module.ts-ben

--- Sprint 4.2: WebSocket Infrastruktúra ---
[x] NestJS @WebSocketGateway létrehozása (ws.gateway.ts: Socket.io, pingInterval, CORS)
[x] JWT autentikáció socket kapcsolaton (handshake.auth.token → jwtService.verify, invalid→disconnect)
[x] Socket room-ok: user:<userId> (privát), clan:<clanId> (klán), global (mindenkinek)
[x] Klán room auto-join ClanMember alapján (connect-kor)
[x] Event tipizálás shared/types.ts-ben (WsEvent enum, WsChatMessage, WsAttackIncoming — már létezett)
[x] Chat handlerek: clan chat, global chat, private message (mind rate-limit-elve)
[x] Rate limiting: sliding window (10 event/sec/socket) — checkRateLimit()
[x] sendAttackNotification + sendNotification publikus metódusok (CombatService számára)
[x] Frontend ws-client.ts: Socket.io singleton, JWT handshake (auth.token), exponential backoff reconnect (1s→30s)
[x] Frontend useWebSocket.ts: Vue composable, auth.token watch → auto connect/disconnect
[x] WsModule (@Global, JwtModule.registerAsync) regisztrálva app.module.ts-ben

--- Sprint 4.3: Feromon-Nyomok ---
[x] Prisma: FeromonTrail modell (clanId, type=ATTACK/DEFEND, path Json, expiresAt, createdBy)
[x] PheromoneService: drawTrail (role check, path 2-50 validálás, DB mentés + WS broadcast), getActiveTrails
[x] PheromoneController: POST /pheromone/draw (DrawTrailDto), GET /pheromone/active/:clanId
[x] WsGateway handlePheromoneDraw: valós idejű broadcast clan:<id> room-ba, role check
[x] MapView.vue: drawMode toggle, mousedown→mousemove→mouseup rajzolás, eventToHex raycasting
[x] Feromon renderelés: Bezier-görbék (quadraticCurveTo), shadowBlur glow (piros=ATTACK, zöld=DEFEND)
[x] Élő rajzolás WebSocket-en (PHEROMONE_DRAW emission, PHEROMONE_VISIBLE listener)
[x] Canvas drawMode UI: ATTACK/DEFEND gombok, pont számláló, Mentés/Törlés/Kilépés
[x] wsClient.on() generikus event listener + wsClient.emit()
[x] PheromoneModule regisztrálva app.module.ts-ben
[x] Canvas cursor kezelés: drawMode=crosshair, pan=grab/grabbing
[ ] Mozgási boost számítás: feromon átfedés detektálás (Phase 5 postponed)

--- Sprint 4.4b: Unit Tesztek Pótlása (ClanService + PheromoneService) ---
[x] ClanService unit tesztek (39 db): createClan, joinClan, leaveClan, promoteMember, tradeResources, setDiplomacy, getDiplomacies, getDiplomaciesForUser, getClan
[x] PheromoneService unit tesztek (14 db): drawTrail, getActiveTrails, broadcastDrawing
[x] Összes teszt zöld: 53 új + 12 meglévő = 65 teszt
[x] Hiányzó peremfeltételek pótolva: getClan (not found, members, leaderId), promoteMember null-target, WsGateway broadcast verifikáció

--- Sprint 4.4: Chat & Közösségi Funkciók ---
[x] Chat store (chat.store.ts): üzenet tömbök (clan/global/private), értesítések, unread számlálók, WebSocket listener regisztráció, parseCommand
[x] ChatPanel.vue: üzenetlista auto-scroll-lal, input parancssorral (/w /c /g), saját/idegen üzenet formázás, Enter küldés, kapcsolódás állapot jelző
[x] ChatView.vue: tabbed nézet (Klán/Globális), privát üzenet sidebar, NotificationPanel integráció
[x] NotificationPanel.vue: csengő ikon olvasatlan badge-dzsel, dropdown értesítési lista, @blur bezárás, Transition animáció
[x] Router frissítve: /chat útvonal (lazy import, requiresAuth meta)
[x] AppShell frissítve: Chat navigációs link (desktop header + mobil bottom nav)
[x] Parancsok: /w <felhasználó> <üzenet> (privát), /c <üzenet> (klán), /g <üzenet> (globális)
[x] WebSocket kapcsolat állapot visszajelzés (ChatPanel: "⚡ Kapcsolódás..." a send gomb tiltásával)

================================================================================
PHASE 5: Terjeszkedés & Rajzás
================================================================================

--- Sprint 5.1: Királynő Képzés ---
[x] Prisma: QueenTraining modell (@unique hiveId, status: TRAINING/READY/CANCELLED, jobId, Hatchery szint követelmény)
[x] shared: QUEEN_DNA_NECTAR_COST=500, QUEEN_MIN_HATCHERY_LEVEL=5, QueenTrainingStatus enum, QueenTrainingData interface
[x] QueenTrainingService: trainQueen (Keltető lv5 check, resource validáció, TOCTOU-védett $transaction, BullMQ delayed job 480 perc)
[x] QueenTrainingService: completeTraining ($transaction: status→READY + QUEEN UnitBatch létrehozás immortal lifespan=0-val)
[x] QueenController: POST /queen/train (JWT védett), GET /queen/status
[x] QueenTrainingProcessor (BullMQ WorkerHost): 3 retry exponenciális backoff-fal, idempotens completeTraining hívás
[x] BullMQ infrastruktúra: BullModule.forRootAsync (Redis kapcsolat ConfigService-ből), QueenModule.registerQueue
[x] QueenModule + app.module.ts regisztráció (ez az ELSŐ BullMQ integráció a projektben!)
[x] Typecheck: shared ✅ + backend ✅, tesztek: 69/69 ✅

--- Sprint 5.2: Rajzás Mechanika ---
[x] AttackType.SWARM hozzáadva shared/enums.ts-hez
[x] SwarmService: initiateSwarm (Queen READY check, target EMPTY validálás, escort unit validálás, Queen+escort eltávolítás $transaction-ben, Movement SWARM létrehozás, BullMQ delayed travel job)
[x] SwarmService: completeSwarm (TOCTOU-védett $transaction: hex EMPTY guard + új Hive STARTING_RESOURCES-szel + Queen Chamber L1 + MapHex→HIVE + Movement törlés)
[x] SwarmService: getActiveSwarms (aktív SWARM mozgások lekérése)
[x] SwarmProcessor: BullMQ WorkerHost, completeSwarm hívás, 3 retry exponenciális backoff-fal
[x] QueenController: POST /queen/swarm (SwarmDto: targetQ/R + escortUnits[]), GET /queen/swarm/status
[x] QueenModule: SWARM_QUEUE regisztrálva, SwarmService+SwarmProcessor regisztrálva
[x] Idempotencia védelem: hex EMPTY guard a $transaction-en belül (race-safe), queenRemaining>0 ellenőrzés
[x] Typecheck: shared ✅ + backend ✅, tesztek: 69/69 ✅

--- Sprint 5.3: Multi-Hive Management UI ---
[x] Backend: GET /hive/list (getAllHives HiveBrief[]), GET /hive?hiveId= paraméter, NotFoundException érvénytelen hiveId esetén
[x] Queen service: trainQueen(), getQueenStatus(), launchSwarm(), getSwarmStatus() — API hívások
[x] Hive service bővítés: getAllHives(), getHive(hiveId?) query paraméterrel
[x] Hive store multi-hive bővítés: hives[], activeHiveId, hasMultipleHives, activeHiveBrief, fetchHives, switchHive
[x] HiveSwitcher.vue — kaptárak közötti dropdown váltás (click-toggle mobilbarát, koordináták + erőforrás előnézet)
[x] QueenTrainingPanel.vue — Királynő képzés UI: státusz (TRAINING/READY/NONE), visszaszámláló timer (30s), progress bar, erőforrás költség rács (4 nyersanyag), Keltető szint ellenőrzés, hiányzó erőforrás lista, train gomb
[x] SwarmTargetPicker.vue — kísérő sereg választó (+/–/max gombok), utazási idő becslés, rajzás indítás, siker állapot
[x] QueenView.vue — Rajzás nézet (HiveSwitcher + QueenTrainingPanel + aktív rajzás lista progress bar-okkal, visszaszámlálóval)
[x] MapView integráció: SwarmTargetPicker meghívása EMPTY hexára kattintáskor, hasReadyQueen ellenőrzés, "Rajzás Indítása" gomb
[x] Router: /queen útvonal (lazy import, requiresAuth)
[x] AppShell: Rajzás navigációs link (desktop header + mobil bottom nav)
[x] Typecheck: shared ✅ + backend ✅ + frontend ✅, tesztek: 69/69 ✅

================================================================================
PHASE 6: Polish, PvE, Monetizáció & Launch
================================================================================

--- Sprint 6.1: PvE Rendszer ---
[x] PveNestTier enum (EASY/MEDIUM/HARD) + PVE_NEST_TIERS konfiguráció (statok, loot, respawnHours tier-enként)
[x] PveNest Prisma modell (@@unique q_r, tier, defeatedAt, respawnAt, jobId) + migráció
[x] PveService: getNests (viewpoint lekérés), getNestTierConfig (tier-ből statok CombatService-nek, read-only), markDefeated (BullMQ respawn job scheduling), respawnNest (state nullázás + MapHex helyreállítás)
[x] PveRespawnProcessor (BullMQ WorkerHost): 3 retry exponenciális backoff-fal
[x] CombatService frissítés: PVE_NEST_PRESET eltávolítva, helyette pveService.getNestTierConfig() tier-ből
[x] MovementService frissítés: sikeres PvE combat után pveService.markDefeated() hívás (fire-and-forget)
[x] PveController: GET /pve/nests?qMin=&qMax=&rMin=&rMax= (NaN védelemmel)
[x] PveModule + PVE_RESPAWN_QUEUE regisztrálva, app.module.ts + CombatModule + MovementModule importálják
[x] Map seed frissítve: PveNest rekordok tier eloszlással (50% EASY / 35% MEDIUM / 15% HARD), deleteMany() idempotens
[x] Typecheck: shared ✅ + backend ✅, tesztek: 69/69 ✅
[x] Code review javítások: dead EngineModule import, NaN query param védelem, getNestTierConfig dead code + side effect eltávolítva, job.id undefined check, map-seed idempotens

--- Sprint 6.2: Monetizáció ---
[x] TransactionType enum (PREMIUM_PURCHASE/COSMETIC_PURCHASE/ZSELE_PACK) + CosmeticSkinType enum (6 skin)
[x] Transaction Prisma modell (userId FK, type, amount, zseleSpent, description) + HiveCosmetic modell (hiveId PK, skinType)
[x] shared/constants.ts: SKIN_COLORS (hex kódok), COSMETIC_COSTS (Zselé árak), PREMIUM_HATCH_BOOST=0.9, PREMIUM_MONTHLY_COST=500
[x] PremiumService: getStatus (JWT-ból tier, elkerüli felesleges DB query-t), activatePremium ($transaction user update + tranzakció), getHatchBoostFactor (1.0 FREE / 0.9 PREMIUM), getCosmetics/setCosmetic (upsert), getTransactions
[x] PremiumController: GET /premium/status, POST /premium/activate, GET /premium/cosmetics, POST /premium/cosmetics (SetCosmeticDto validációval), GET /premium/transactions
[x] MilitaryService: hatch boost alkalmazva (calculateHatchTime * boostFactor, TODO BullMQ job delay-hoz)
[x] PremiumModule + app.module.ts + MilitaryModule regisztráció
[x] Code review javítások: SKIN_COLORS/COSMETIC_COSTS shared-be, SetCosmeticDto class-validator, getStatus JWT optimalizálás, TODO kommentek
[x] Typecheck: shared ✅ + backend ✅, tesztek: 69/69 ✅
[~] Stripe integráció (PaymentProvider interfész placeholder — Stripe SDK + webhook kezelés később)

--- Sprint 6.3: UI Polírozás ---
[x] ErrorBoundary.vue: onErrorCaptured, fallback UI retry gombbal, hiba részletek toggle, :aria-expanded
[x] LoadingSkeleton.vue: shimmer CSS animáció, 4 variáns (card/text/resource/chamber-grid), role="status", sr-only fallback
[x] main.css: @keyframes chamber-pulse (box-shadow pulse + hover lift), skeleton-shimmer-anim, page-enter (opacity+tY), *:focus-visible ring, @media (pointer: coarse) touch targets, safe-area body padding
[x] AppShell.vue: role="banner", aria-label logo/nav/main/logout, page-enter main-en, safe-area mobil nav-on
[x] ChamberCard.vue: chamber-card pulse osztály, aria-label + title upgrade gombon
[x] HiveSwitcher.vue: :aria-haspopup/:aria-expanded, role="listbox", role="option" + :aria-selected
[x] HiveView.vue: LoadingSkeleton (resource + chamber-grid), ErrorBoundary wrappolás
[x] Typecheck: frontend vue-tsc ✅
[~] ARIA label-ek további komponenseken (AttackPanel, CombatReport, ChatPanel, NotificationPanel stb.) — következő körben

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
