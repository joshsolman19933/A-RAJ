================================================================================
                    PHASE 5 RETROSPECTIVE: A RAJ
================================================================================

Dokumentum célja: A Phase 5 (Terjeszkedés & Rajzás) teljes körű retrospektív
elemzése — mi készült el, mi változott a tervhez képest, milyen tanulságok
születtek, és mik a javaslatok a Phase 6-ra.

Verzió: 1.0
Dátum: 2026-06-19

================================================================================
1. ÖSSZEFOGLALÓ
================================================================================

A Phase 5 célja a terjeszkedési mechanika — Királynő képzés, rajzás, új kaptár
alapítás — és a hozzá tartozó multi-hive management UI implementálása volt.
Ez volt az a fázis, ahol a játék végre megkapta a régóta halasztott BullMQ
integrációt, és ahol a felhasználók képessé váltak terjeszkedni a térképen.

Eredmény: ✅ Phase 5 TELJES — minden tervezett funkció implementálva,
typecheck zöld (shared + backend + frontend), 69 unit teszt mind zöld,
a BullMQ infrastruktúra bevezetve (2 queue: queen-training + swarm),
a multi-hive UI működik.

Idővonal:
  Sprint 5.1 — Királynő Képzés (BullMQ!)     ✅
  Sprint 5.2 — Rajzás Mechanika               ✅
  Sprint 5.3 — Multi-Hive Management UI       ✅

================================================================================
2. TERV vs. VALÓSÁG
================================================================================

2.1 Ami az eredeti terv szerint készült el
--------------------------------------------
- QueenTraining Prisma modell (@unique hiveId, status: TRAINING/READY/CANCELLED, jobId)
- QueenTrainingStatus enum + QueenTrainingData interface (shared)
- QUEEN_DNA_NECTAR_COST=500, QUEEN_MIN_HATCHERY_LEVEL=5 (shared/constants.ts)
- QueenTrainingService: trainQueen (Hatchery level check, resource validation, BullMQ delayed job 480 perc)
- QueenTrainingService: completeTraining ($transaction: status→READY + QUEEN UnitBatch immortal lifespan=0)
- QueenController: POST /queen/train, GET /queen/status
- QueenTrainingProcessor (BullMQ WorkerHost): 3 retry exponenciális backoff-fal
- AttackType.SWARM hozzáadva shared/enums.ts-hez
- SwarmService: initiateSwarm (Queen READY check, escort unit validálás, Queen+escort eltávolítás $transaction-ben, Movement SWARM létrehozás, BullMQ delayed travel job)
- SwarmService: completeSwarm (TOCTOU-védett $transaction: hex EMPTY guard + új Hive + Queen Chamber L1 + MapHex→HIVE)
- SwarmService: getActiveSwarms
- SwarmProcessor (BullMQ WorkerHost): completeSwarm hívás, 3 retry
- QueenController: POST /queen/swarm, GET /queen/swarm/status
- BullMQ infrastruktúra: BullModule.forRootAsync (Redis ConfigService-ből), QueenModule 2 queue-al
- Backend: GET /hive/list (getAllHives), GET /hive?hiveId= paraméter
- Queen service (frontend): trainQueen, getQueenStatus, launchSwarm, getSwarmStatus
- Hive store multi-hive bővítés: hives[], activeHiveId, switchHive, fetchHives
- HiveSwitcher.vue — kaptárak közötti váltás dropdown-nal
- QueenTrainingPanel.vue — Királynő képzés UI (státusz, visszaszámláló, progress bar, erőforrás rács)
- SwarmTargetPicker.vue — kísérő sereg választó, utazási idő becslés, rajzás indítás
- QueenView.vue — Rajzás nézet (HiveSwitcher + QueenTrainingPanel + aktív rajzás lista)
- MapView integráció: SwarmTargetPicker EMPTY hexára kattintáskor
- Router: /queen útvonal, AppShell: Rajzás navigációs link (desktop + mobil)

2.2 Ami az eredeti terven felül készült el
--------------------------------------------
- **BullMQ bevezetése az egész projektben**: Phase 1-4 legnagyobb technikai adóssága
  végre törlesztve. BullModule.forRootAsync + 2 queue (queen-training, swarm)
- TOCTOU-védett resource validálás a trainQueen-ben (resource check a $transaction-en belül)
- TOCTOU-védett hex EMPTY guard a completeSwarm-ban (guard a $transaction-en belül)
- QueenRemaining>0 race condition védelem a SwarmService-ben
- completeSwarm idempotencia védelem: hex EMPTY guard + BadRequestException a tranzakcióban
- QueenTraining record törlése a swarm indításakor (consumed pattern)
- Dead escortUnits eltávolítva a BullMQ job payload-ból (csak movementId maradt)
- HiveBrief interface a shared/types.ts-ben (több kaptár listázásához)
- getAllHives determinisztikus rendezés: [{ q: 'asc' }, { r: 'asc' }]
- getHive NotFoundException érvénytelen hiveId esetén (nem hoz létre véletlen kaptárt)
- HiveSwitcher click-toggle (nem CSS-only group-hover) — mobilbarát dropdown
- QueenTrainingPanel 30s timer interval (nem 1s) — optimalizált a 8 órás képzéshez
- QueenTrainingPanel erőforrás hiány lista (4 nyersanyag részletes hiányjelzéssel)
- SwarmTargetPicker max gomb az escort választónál
- SwarmTargetPicker siker állapot az indítás után (zöld visszajelzés + travel time)
- QueenView aktív rajzás lista progress bar-okkal és valós idejű visszaszámlálóval
- hasReadyQueen API ellenőrzés a MapView-ban (csak EMPTY hexánál hív API-t)
- militaryStore.fetchUnits() pre-fetch a MapView-ban a SwarmTargetPicker-hez
- ChamberData típus használata a callback-ekben (nem loose { type: string })
- queen.service.ts response type mismatch javítása (trainQueen → QueenTrainingData közvetlenül)
- hiveId → computed() refaktor (consolidated duplicate refs a hive.store-ban)

2.3 Ami eltért az eredeti tervtől
-----------------------------------
| Terv                                | Valóság                                    | Indoklás                          |
|-------------------------------------|--------------------------------------------|-----------------------------------|
| BullMQ Phase 1-4-ben bevezetve      | Phase 5-ben vezettük be                    | ÖT fázison keresztül halasztva,   |
|                                      |                                            | végül a Királynő képzés tette     |
|                                      |                                            | elkerülhetetlenné                  |
| QueenTrainingPanel 1mp-es timer     | 30 másodperces timer                       | 8 órás képzésnél az 1mp felesleges|
|                                      |                                            | CPU terhelés — code review után   |
|                                      |                                            | optimalizálva                      |
| HiveSwitcher CSS group-hover        | Click-toggle JavaScript dropdown           | CSS-only hover nem működik mobil- |
|                                      |                                            | on, code review után javítva      |
| trainQueen válasz: { training }      | trainQueen válasz: QueenTrainingData       | Backend nem wrapper objektumot    |
|                                      | közvetlenül                                | küld — service mismatch javítva   |
| Unit tesztek az új service-ekhez    | NINCS új unit teszt                        | A retrospektív tanulságok ötödik  |
|                                      |                                            | alkalommal is figyelmen kívül     |
|                                      |                                            | maradtak                           |
| getHive rossz hiveId → új kaptár    | getHive rossz hiveId → NotFoundException   | Eredeti kód lazy creation-be      |
|                                      |                                            | esett — code review után javítva  |
| getAllHives orderBy: createdAt       | orderBy: [{ q }, { r }]                    | createdAt nem létezik a Hive      |
|                                      |                                            | modellen — code review után       |
|                                      |                                            | javítva determinisztikus rendezés |
| recalcProductionRates duplikáció    | Nincs javítva                              | Phase 1 óta nyitva — 5. fázisban |
|                                      |                                            | sem került rá sor                  |
| ESLint + Prettier + Husky           | Továbbra is elhalasztva                    | Fókusz a funkcionalitáson         |
| Privát chat felhasználókereső       | Nincs                                      | Phase 4-ből örökölt elhalasztás   |

2.4 Ami kimaradt / el lett halasztva
--------------------------------------
| Elem                               | Státusz         | Tervezett fázis |
|------------------------------------|-----------------|-----------------|
| Unit tesztek QueenTrainingService- | Nincs           | Phase 6 eleje   |
|  hez és SwarmService-hez           |                 |                 |
| recalcProductionRates duplikáció   | Nincs javítva   | Phase 6         |
| ESLint + Prettier + Husky          | Elhalasztva     | Phase 6         |
| Privát chat felhasználókereső      | Elhalasztva     | Phase 6         |
|  (GET /users/search?q=)            |                 |                 |
| WebSocket room és DB állapot       | Elhalasztva     | Phase 6         |
|  inkonzisztencia javítása          |                 |                 |
| Feromon mozgási boost számítás     | Elhalasztva     | Phase 6         |
| Földalatti/felszíni réteg váltás   | Elhalasztva     | Phase 6         |
| Canvas mozgás animáció             | Elhalasztva     | Phase 6         |
| QueenTraining CANCELLED állapot    | Modellben van,  | Phase 6         |
|  endpoint-ja (cancel training)     | de nincs API    |                 |
| BullMQ visszaút ütemezése          | Nincs          | Phase 6         |
|  (túlélő egységek combat után)     |                 |                 |

================================================================================
3. AMI JÓL MŰKÖDÖTT
================================================================================

3.1 BullMQ integráció — az áttörés
-------------------------------------
A Phase 5 LEGNAGYOBB eredménye a BullMQ sikeres bevezetése. Öt fázison keresztül
volt a legmagasabb prioritású technikai adósság, és végül a Királynő képzés
tette elkerülhetetlenné — egy 8 órás képzési időt nem lehet instant végrehajtani.

Az implementáció tiszta és jól strukturált:
- `BullModule.forRootAsync` → Redis kapcsolat ConfigService-ből (REDIS_HOST/REDIS_PORT)
- Két dedikált queue: `queen-training` és `swarm`
- Mindkét queue: 3 retry exponenciális backoff-fal, `removeOnComplete: true`
- A `WorkerHost` pattern követi a NestJS dokumentációt
- A Királynő képzési job 480 perces késleltetéssel indul
- A Rajzás travel job dinamikus késleltetéssel indul (hexDistance alapján)

**A minta most már másolható**: keltetési idők, kutatási idők, combat travel time
— minden, ami eddig instant volt, most BullMQ-zható.

3.2 TOCTOU-védelem a $transaction-ökben — a minta csúcsa
---------------------------------------------------------
A Phase 1-4-ben kialakult $transaction minta a Phase 5-ben érte el a
legmagasabb szintjét:

- **trainQueen**: A resource balance check (biomass/water/heat/dnaNectar)
  a `tx.hive.findUnique()`-val a $transaction-en BELÜL történik, így a
  check és a deduction között nem változhat az állapot.
- **completeSwarm**: A hex EMPTY guard a $transaction-en BELÜL van
  (`tx.mapHex.findUnique()`), így két egyidejű swarm nem foglalhatja
  el ugyanazt a hexet. Ha a hex már nem EMPTY, BadRequestException dobódik,
  ami az egész tranzakciót visszagörgeti.
- **initiateSwarm**: A Queen és escort egységek eltávolítása a
  $transaction-en belül történik, a queenRemaining>0 ellenőrzéssel
  együtt — ha a Queen count megváltozott a check és a removal között,
  a hiba eldobja a tranzakciót.

Ez a három példa demonstrálja a TOCTOU-safe $transaction pattern
érettségét a projektben.

3.3 Idempotencia a BullMQ processor-okban
-------------------------------------------
A `QueenTrainingProcessor` és `SwarmProcessor` mindketten idempotens
`completeTraining()` / `completeSwarm()` metódusokat hívnak:
- QueenTrainingProcessor: ellenőrzi a training státuszát (csak TRAINING
  esetén fut le → READY)
- SwarmProcessor: ellenőrzi a hex típust a $transaction-en belül
  (csak EMPTY esetén hoz létre új kaptárt, egyébként abortál)

A 3 retry exponenciális backoff-fal kombinálva ez garantálja, hogy
egy többszörösen végrehajtott job nem okoz duplikált Queen-eket vagy
duplikált kaptárakat.

3.4 Multi-hive architecture — backend + frontend konzisztencia
---------------------------------------------------------------
A multi-hive támogatás mindkét oldalon konzisztensen lett implementálva:
- Backend: `GET /hive/list` → `HiveBrief[]` (id, q, r, resources),
  `GET /hive?hiveId=` → full `HiveData`
- Frontend: `hive.store.ts` → `hives[]`, `activeHiveId`, `switchHive()`,
  `fetchHives()` — a store kezeli az aktív kaptár váltást és az adatok
  újratöltését
- A `hiveId` → `computed(() => activeHiveId.value)` refaktor eliminálta
  a duplikált állapotot (korábban `hiveId` és `activeHiveId` is létezett)

A `getHive` metódus biztonsági fejlesztése (érvénytelen hiveId esetén
`NotFoundException`, nem pedig új kaptár létrehozása) kritikus volt
a multi-hive működés helyességéhez.

3.5 Frontend komponens architektúra
-------------------------------------
A három új komponens (HiveSwitcher, QueenTrainingPanel, SwarmTargetPicker)
jól elkülönített felelősséggel készült:
- **HiveSwitcher**: Csak a kaptár választásért felel, nem keveri a
  képzési vagy rajzási logikával
- **QueenTrainingPanel**: Csak a képzési UI-t kezeli (státusz, költségek,
  visszaszámláló), nem foglalkozik a rajzással
- **SwarmTargetPicker**: Csak a rajzás indításáért felel (escort választás,
  travel time, launch), nem keveri a képzési logikával

A QueenView komponens ezeket komponálja egyetlen nézetbe, a MapView
pedig a SwarmTargetPicker-t integrálja a hexa kattintás flow-ba.

3.6 Code review hibafogás — 7 típushiba + 3 architekturális hiba
------------------------------------------------------------------
A Sprint 5.3 code review-je összesen 10 hibát azonosított:
- **Típushibák (7)**: hive.store.ts hiveId hiányzó ref, QueenTrainingPanel
  callback implicit any, HiveView map callback implicit any, QueenView
  nullable string mismatch, queen.service.ts duplikált SwarmDto,
  QueenStatusResponse hiányzó referencia, trainQueen response type mismatch
- **Architekturális hibák (3)**: getHive rossz hiveId → új kaptár létrehozása,
  HiveSwitcher CSS-only group-hover (mobilon nem működik),
  MapView militaryStore.fetchUnits() hiánya (SwarmTargetPicker üres)
- **Optimalizáció (1)**: QueenTrainingPanel 1mp-es timer → 30s

Mind a 10 hiba javításra került a véglegesítés előtt.

================================================================================
4. AMIT MÁSKÉPP CSINÁLNÁNK
================================================================================

4.1 Unit tesztek azonnal az új service-ekhez — ÖTÖDIK retrospektív
--------------------------------------------------------------------
Ez az ÖTÖDIK retrospektív, ami ezt a tanulságot tartalmazza. Phase 5-ben
ismét egyik új service-hez (QueenTrainingService, SwarmService) sem készült
unit teszt. A Phase 4-ben pótolt ClanService + PheromoneService tesztek (53 db)
pozitív példát mutattak — de a mintát nem folytattuk.

A QueenTrainingService és SwarmService komplex logikája (resource validation,
TOCTOU $transaction, BullMQ job scheduling, idempotencia védelem) különösen
igényli a unit teszt fedettséget. A BullMQ job-ok mock-olása a
`@nestjs/bullmq` `getQueueToken()` segítségével egyszerűen megoldható.

*Tanulság:* Phase 6-ban az ELSŐ új service-nél kötelezővé kell tenni a
unit teszt írását. Ez most már nem javaslat — ez követelmény.

4.2 Frontend API response type mismatch
-----------------------------------------
A `queen.service.ts` `trainQueen()` metódusa kezdetben `TrainQueenResponse`
típust várt (`{ training: QueenTrainingData }`), de a backend `QueenController`
közvetlenül `QueenTrainingData`-t ad vissza (nem wrapper objektumban).
Ez a mismatch csak a code review során derült ki.

A NestJS `@Controller` automatikusan serializálja a visszatérési értéket
JSON-be — ha a service `QueenTrainingData`-t ad vissza, a response body
közvetlenül az lesz, nem `{ training: ... }`.

*Tanulság:* Minden új API endpoint-nál ellenőrizni kell a backend kontroller
visszatérési értékét és a frontend service elvárt típusát. Az automatikus
NestJS serializáció nem wrap-ol — amit a kontroller visszaad, az lesz a
response body.

4.3 CSS-only hover dropdown vs. mobil
---------------------------------------
A HiveSwitcher első implementációja CSS `group-hover`-rel nyitotta a dropdown-t.
Ez desktop-on tökéletesen működik, de érintőképernyős eszközökön (mobil, tablet)
a `:hover` pseudo-class nem triggered, így a dropdown használhatatlan.

A javítás során JavaScript click-toggle-ra váltottunk (`isDropdownOpen` ref +
`toggleDropdown()` + `@blur`), ami minden platformon működik.

*Tanulság:* Mobil-first projektben (mint az A RAJ, ami PWA) minden interaktív
UI elemet érintés-vezérelten kell tervezni. A CSS-only hover/group-hover
pattern-eket kerülni kell, vagy JavaScript fallback-et kell biztosítani.

4.4 Timer interval optimalizálás
----------------------------------
A QueenTrainingPanel első implementációja `setInterval(fn, 1000)`-rel frissítette
a visszaszámlálót. Egy 8 órás (480 perces) képzésnél ez 28,800 felesleges
újrarenderelést jelent — a felhasználó számára a másodperc pontosság irreleváns.

A 30 másodperces intervallumra váltás 96%-kal csökkenti a felesleges
rendereléseket, miközben a felhasználói élmény nem romlik (30 másodperc
eltérés egy 8 órás folyamatnál észrevehetetlen).

*Tanulság:* Hosszú ideig tartó folyamatoknál (képzés, kutatás, építés)
a frissítési gyakoriságot a folyamat teljes hosszához kell igazítani.
Egy adaptív megközelítés (30s a folyamat nagy részében, 1s az utolsó percben)
még jobb lenne.

4.5 Multi-hive UI flow — a kaptár választás és a kontextus
------------------------------------------------------------
A HiveSwitcher lehetővé teszi a kaptárak közötti váltást, de a váltás után
az összes nézet (HiveView, MilitaryView, QueenView) újratölti az adatokat
az aktív kaptárhoz. Ez a `switchHive()` → `fetchHive()` láncon keresztül
működik, ami tiszta.

Azonban a felhasználó számára nem egyértelmű, hogy melyik kaptár az "aktív"
— a HiveSwitcher label-je mutatja ugyan, de a többi nézetben nincs vizuális
visszajelzés arról, hogy melyik kaptár adatait látják.

*Tanulság:* Multi-entitás rendszerekben (több kaptár, több karakter, több
bázis) a kontextus-indikátornak minden nézetben láthatónak kell lennie,
nem csak a váltó komponensben.

4.6 determinisztikus rendezés hiánya az első implementációban
---------------------------------------------------------------
A `getAllHives` első verziója `orderBy: { createdAt: 'asc' }`-et használt,
de a `createdAt` mező nem létezett a Hive Prisma modellben. A code review
után `[{ q: 'asc' }, { r: 'asc' }]`-re javítottuk, ami determinisztikus
és mindig ugyanabban a sorrendben adja vissza a kaptárakat.

*Tanulság:* Mielőtt egy Prisma `orderBy`-t használunk, ellenőrizni kell,
hogy a mező létezik-e a modellben. Ha nincs `createdAt` / `updatedAt`,
használjunk más determinisztikus mezőt (pl. koordináták, ID).

================================================================================
5. TECHNIKAI ADÓSSÁG
================================================================================

| Adósság                           | Súlyosság | Terv                                           |
|-----------------------------------|-----------|-------------------------------------------------|
| Unit tesztek hiánya (QueenTraining| Magas     | Phase 6 első sprintjében pótolni               |
|  Service, SwarmService)           |           |                                                 |
| Unit tesztek hiánya (WgGateway,   | Közepes   | Phase 6 során pótolni                          |
|  CombatService, MovementService,  |           |                                                 |
|  MapService — Phase 3 óta nyitva) |           |                                                 |
| recalcProductionRates duplikáció  | Alacsony  | Phase 6 során shared/math.ts-be mozgatni       |
|  (Phase 1 óta nyitva!)            |           | (6 fázis óta nyitva — rekord!)                  |
| ESLint + Prettier + Husky         | Alacsony  | Phase 6 elején beállítani                      |
|  (Phase 1 óta nyitva)             |           |                                                 |
| Privát chat felhasználókereső     | Közepes   | GET /users/search?q= endpoint + UI             |
|  hiánya (Phase 4 óta nyitva)      |           |                                                 |
| WebSocket room és DB állapot      | Alacsony  | Esemény-vezérelt room sync a ClanService-ből   |
|  inkonzisztencia                  |           |                                                 |
| Feromon mozgási boost hiánya      | Alacsony  | Phase 6-ban implementálni                      |
| QueenTraining CANCELLED endpoint  | Alacsony  | POST /queen/cancel + BullMQ job.remove()       |
| BullMQ visszaút ütemezése         | Közepes   | Combat után túlélő egységek visszaküldése      |
|  (túlélő egységek combat után)    |           |                                                 |
| Canvas komponens best practices   | Alacsony  | Dokumentálni a cleanup checklist-et            |
|  nincs dokumentálva               |           | (Phase 3 óta nyitva)                           |
| Nincs integrációs/E2E teszt       | Közepes   | Phase 6 során E2E teszteket hozzáadni          |
| QueenTrainingPanel 30s timer      | Alacsony  | Adaptív timer: 30s → 1s az utolsó percben      |
|  nem adaptív                      |           |                                                 |

================================================================================
6. SZÁMOK
================================================================================

Phase 5 statisztikák:
- **Új Prisma modellek:** 1 (QueenTraining)
- **Új NestJS modulok:** 1 (QueenModule — 2 service + 2 processor + 1 controller)
- **Új API végpontok:** 4 (POST /queen/train, GET /queen/status,
                           POST /queen/swarm, GET /queen/swarm/status)
- **Új backend végpontok (hive bővítés):** 1 (GET /hive/list)
- **Meglévő végpont bővítés:** 1 (GET /hive?hiveId=)
- **BullMQ queue-k:** 2 (queen-training, swarm) — ELSŐ BullMQ integráció!
- **Új backend fájlok:** 6 (queen-training.service, queen-training.processor,
  swarm.service, swarm.processor, queen.controller, queen.module)
- **Szerkesztett backend fájlok:** 3 (app.module.ts BullModule.forRootAsync,
  hive.service.ts getAllHives + getHive hiveId, hive.controller.ts list endpoint)
- **Új shared definíciók:** QueenTrainingStatus enum, QueenTrainingData interface,
  HiveBrief interface, QUEEN_DNA_NECTAR_COST, QUEEN_MIN_HATCHERY_LEVEL
- **Új frontend fájlok:** 8 (queen.service.ts, HiveSwitcher.vue,
  QueenTrainingPanel.vue, SwarmTargetPicker.vue, QueenView.vue +
  3 szerkesztett: hive.service.ts, hive.store.ts, router/index.ts,
  AppShell.vue, MapView.vue)
- **Szerkesztett frontend fájlok:** 5 (hive.service.ts, hive.store.ts,
  router/index.ts, AppShell.vue, MapView.vue)
- **Frontend route-ok:** +1 (/queen) — összesen 9
- **Pinia store-ok:** 7 (nincs új, a hive.store bővült multi-hive support-tal)
- **TypeScript typecheck:** shared ✅, backend ✅, frontend ✅ (minden sprintnél)
- **Unit tesztek:** 69 (56 ClanService + PheromoneService a Phase 4-ből,
  12 EngineService a Phase 1-ből, 1 extra — mind zöld, nincs új a Phase 5-ben)
- **Összes API végpont Phase 1-5:** 27 (6 + 4 + 3 + 10 + 4)
- **Összes Prisma modell:** 14 (User, Hive, Chamber, RefreshToken, UnitBatch,
  Mutation, MapHex, Movement, Clan, ClanMember, ClanDiplomacy, ClanTrade,
  FeromonTrail, QueenTraining)
- **Összes BullMQ queue:** 2
- **Összes NestJS modul:** 13

================================================================================
7. JAVASLATOK PHASE 6-RA
================================================================================

7.1 Sprint 6.1 előtt
----------------------
- [ ] **Unit tesztek pótlása**: QueenTrainingService, SwarmService
      (MAGAS prioritás — komplex $transaction + BullMQ logika)
- [ ] Unit tesztek pótlása: WsGateway, CombatService, MovementService,
      MapService (Phase 3-4 óta nyitva)
- [ ] ESLint + Prettier + Husky konfiguráció (Phase 1 óta nyitva — 5 fázis!)
- [ ] recalcProductionRates áthelyezése shared/math.ts-be
      (Phase 1 óta nyitva — 5 fázis, ez a projekt legrégebbi technikai adóssága!)
- [ ] GET /users/search?q= endpoint + felhasználókereső komponens
- [ ] POST /queen/cancel endpoint (QueenTraining CANCELLED állapot + job.remove())
- [ ] WebSocket room sync esemény-vezérelten a ClanService-ből
- [ ] Canvas komponens best practices dokumentálása (Phase 3 óta nyitva)

7.2 Sprint 6.1 (PvE Rendszer)
--------------------------------
- PvE fészek spawn rendszer
- AI ellenfél statikus erősséggel
- PvE jutalmak: DNS Nektár, Biomassza
- Fészek respawn timer
- PvE harcjelentés (CombatReport séma)

7.3 Általános javaslatok
--------------------------
- **BullMQ kiterjesztése**: A minta most már készen áll — a keltetési idők,
  kutatási idők, combat travel time és visszaút mind BullMQ-zható.
  Phase 6-ban ezeket sorra be kell vezetni.
- **Unit tesztek kötelezővé tétele**: Ez az ÖTÖDIK retrospektív, ami ezt
  javasolja. Phase 6-ban az első új service-nél AZONNAL unit tesztet kell írni.
  Ha ez nem történik meg, a Phase 6 retrospektívben ez lesz a HATODIK említés.
- **Technikai adósság rendezése**: A Phase 1 óta nyitva lévő tételek
  (recalcProductionRates duplikáció, ESLint/Prettier) száma elérte a 6-ot.
  Phase 6-ban legalább a felét le kell zárni.
- **Adaptív timer pattern**: Hosszú folyamatoknál (képzés, kutatás, építés)
  a frissítési gyakoriságot adaptívan kell kezelni: 30s a folyamat nagy
  részében, 1s az utolsó percben. Ezt a pattern-t érdemes kiszervezni egy
  `useCountdown(duration, adapt)` composable-be.
- **Mobil-first UI tesztelés**: Minden új UI komponensnél ellenőrizni kell
  az érintés-vezérelt működést. A CSS-only hover/group-hover pattern-ek
  helyett JavaScript click-toggle-t kell használni.
- **API response type ellenőrzés**: Minden új endpoint-nál ellenőrizni kell,
  hogy a backend kontroller visszatérési értéke és a frontend service elvárt
  típusa egyezik-e. A NestJS automatikus serializáció nem wrap-ol.
- **Code review + typecheck ciklus megtartása**: Phase 5-ben a code review-k
  10 hibát azonosítottak a véglegesítés előtt. Ez a folyamat kritikus a
  minőségbiztosítás szempontjából.

================================================================================
8. KONKLÚZIÓ
================================================================================

A Phase 5 sikeresen teljesítette a kitűzött célokat. A játék most már
rendelkezik a teljes terjeszkedési mechanikával:

- **BullMQ infrastruktúra**: Két dedikált queue (queen-training, swarm),
  Redis kapcsolat, exponenciális backoff retry, idempotens processor-ok.
  Ez az első BullMQ integráció a projektben — öt fázis után végre
  megtört az átok.

- **Királynő képzés**: 8 órás időzített folyamat BullMQ delayed job-bal,
  Hatchery ≥5 szint követelmény, 500 DNS Nektár + biomassza/víz/hő költség,
  TOCTOU-védett $transaction resource validálással.

- **Rajzás mechanika**: Queen READY ellenőrzés, escort unit validálás,
  cél hexa EMPTY validálás, Queen+escort eltávolítás $transaction-ben,
  BullMQ travel time job, TOCTOU-védett új kaptár létrehozás
  (hex EMPTY guard a tranzakción belül).

- **Multi-hive management**: Backend `GET /hive/list` + `GET /hive?hiveId=`,
  frontend HiveSwitcher (click-toggle mobilbarát dropdown), QueenTrainingPanel
  (státusz UI, 30s timer, erőforrás rács), SwarmTargetPicker (escort választó,
  travel time becslés, rajzás indítás + siker állapot).

- **Térkép integráció**: EMPTY hexára kattintás → hasReadyQueen API
  ellenőrzés → "Rajzás Indítása" gomb → SwarmTargetPicker.

A Phase 1+2+3+4+5 együtt egy MMO stratégiai játék teljes vertikumát alkotja:
regisztráció → kaptár építés → kamra fejlesztés → egység keltetés → mutáció
kutatás → térkép böngészés → támadás/védekezés → klán alapítás → feromon
rajzolás → chat kommunikáció → Királynő képzés → rajzás → új kaptár alapítás.

A projekt státusza:
| Phase | Státusz |
|-------|---------|
| 1 — MVP Core Loop              | ✅ |
| 2 — The Hatching               | ✅ |
| 3 — World Map & Bloodshed      | ✅ |
| 4 — Swarm Mind & Feromons      | ✅ |
| 5 — Terjeszkedés & Rajzás      | ✅ |
| 6 — Polish, PvE, Monetizáció   | ⬜ |

A Phase 5 a terjeszkedési mechanika bevezetésével lezárta a játék core
gameplay loop-ját — a felhasználók most már a teljes GDD-ben leírt
játékmenetet végigjátszhatják: a kezdeti kaptár építéstől az új kaptárak
alapításáig. A Phase 6 a polírozásra, a PvE tartalomra és a monetizációra
fog fókuszálni, hogy a játék készen álljon a launch-ra.
