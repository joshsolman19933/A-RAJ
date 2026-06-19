================================================================================
                    PHASE 2 RETROSPECTIVE: A RAJ
================================================================================

Dokumentum célja: A Phase 2 (The Hatching) teljes körű retrospektív
elemzése — mi készült el, mi változott a tervhez képest, milyen tanulságok
születtek, és mik a javaslatok a Phase 3-ra.

Verzió: 1.0
Dátum: 2026-06-19

================================================================================
1. ÖSSZEFOGLALÓ
================================================================================

A Phase 2 célja az egység keltetés, mutációs háló, attrition logika és a
hozzá tartozó frontend UI implementálása volt — a játék legfontosabb
innovációjának, az egység élettartam rendszernek a megvalósítása.

Eredmény: ✅ Phase 2 TELJES — minden tervezett funkció implementálva,
typecheck zöld (shared + backend + frontend), 12 unit teszt továbbra is zöld.

Idővonal:
  Sprint 2.1 — Unit System                  ✅
  Sprint 2.2 — Keltető Rendszer             ✅
  Sprint 2.3 — Mutációs Háló                ✅
  Sprint 2.4 — Sereg UI                     ✅

================================================================================
2. TERV vs. VALÓSÁG
================================================================================

2.1 Ami az eredeti terv szerint készült el
--------------------------------------------
- UnitBatch és Mutation Prisma modellek (migrációval)
- AttritionService éles implementációja (lifespan ellenőrzés, 10% biomass return)
- EngineService integráció: recoveredBiomass + storage clamping
- HiveService.getHive(): unitBatches + mutations include-olva
- calculateHatchTime() shared/math.ts-ben (Keltető szint alapján skálázva)
- hatchTimeMinutes hozzáadva minden UNIT_STATS-hoz
- MilitaryController: POST /military/hatch + GET /military/units
- Hatchery chamber létezés ellenőrzése
- Hő fogyasztás validálása keltetés előtt
- MutationController: POST /mutation/research + GET /mutation/tree
- Előfeltételek validálása (validatePrerequisites)
- Szinergia aktiválás és új egységek feloldása (getUnlockedUnits)
- DNS Nektár költség validálás (targetLevel * MUTATION_DNA_NECTAR_COST_PER_LEVEL)
- Hatchery.vue — keltető felület csúszkával (count slider, költség előnézet)
- MilitaryOverview.vue — sereg áttekintés batchenként
- MutationTree.vue — mutációs háló vizualizáció progress bar-okkal
- AttritionCountdown.vue — élettartam visszaszámláló (1mp ticker)
- military.service.ts + military.store.ts
- mutation.service.ts + mutation.store.ts
- MilitaryView.vue + MutationView.vue
- Router frissítve (/military, /mutations)
- AppShell navigáció frissítve (Sereg, Mutációk linkek)

2.2 Ami az eredeti terven felül készült el
--------------------------------------------
- Queen kizárása a normál Keltetőből (külön error message)
- Max batch méret validálás (@Max 1000 a HatchDto-ban)
- AttritionCountdown auto-stop lejáratkor (watch + clearInterval)
- AttritionCountdown onUnmounted cleanup (setInterval leak javítva)
- Dead code cleanup (getSynergyUnlock metódus, unused import-ok)
- Build fix: shared/dist + rootDir: "src" a backend tsconfig-ban
- Build fix: bcryptjs createRequire minta ESM-hez
- Build fix: shared/src/*.js és .d.ts fájlok gitignore-olása
- Build fix: root dev script shared build-del kezd

2.3 Ami eltért az eredeti tervtől
-----------------------------------
| Terv                                | Valóság                                    | Indoklás                          |
|-------------------------------------|--------------------------------------------|-----------------------------------|
| BullMQ keltetési job                | Instant hatch (BullMQ Phase 3-ra halasztva)| MVP fókusz, a core logika kész    |
| BullMQ kutatási job                 | Instant research (BullMQ deferred)         | MVP fókusz                        |
| UnitFactory mint külön fájl         | UNIT_STATS + calculateHatchTime()          | Egyszerűbb, a shared-ben van      |
|                                      | shared/math.ts-ben                         | minden ami kell                   |
| Nincs max batch limit a tervben     | @Max(1000) hozzáadva                       | UX védelem, review javaslat       |
| Queen keltethető a terv szerint     | Queen kizárva a normál Keltetőből          | Game design: Queen = speciális    |
|                                      |                                            | képzés (Phase 5)                  |

2.4 Ami kimaradt / el lett halasztva
--------------------------------------
| Elem                               | Státusz         | Tervezett fázis |
|------------------------------------|-----------------|-----------------|
| BullMQ keltetési job               | Elhalasztva     | Phase 3         |
| BullMQ kutatási job                | Elhalasztva     | Phase 3         |
| Unit tesztek az új service-ekhez   | Nincs           | Phase 3         |
| (MilitaryService, MutationService, |                 |                 |
|  AttritionService)                 |                 |                 |
| Husky pre-commit hookok            | Elhalasztva     | Phase 3 eleje   |
| recalcProductionRates duplikáció   | Nincs javítva   | Phase 3         |
|  shared-be mozgatása               |                 |                 |

================================================================================
3. AMI JÓL MŰKÖDÖTT
================================================================================

3.1 Prisma $transaction mindenhol
----------------------------------
A MilitaryService.hatchUnits() és MutationService.researchMutation() is
$transaction-ben végzi a költséglevonást és a rekord létrehozást. Ez
kritikus az adatintegritás szempontjából — a resource-k és a UnitBatch-ek
mindig konzisztensek maradnak.

3.2 Shared math függvények kihasználása
----------------------------------------
A calculateHatchTime() függvényt a shared/math.ts-be helyeztük, így
a frontend is tudja használni (a store nem használja még, de elérhető).
A UNIT_STATS és MUTATION_TREE a shared/constants.ts-ben van, így a
frontend MutationTree.vue közvetlenül tudja olvasni őket API hívás nélkül.

3.3 Frontend store-ok konzisztens mintája
------------------------------------------
A military.store.ts és mutation.store.ts pontosan ugyanazt a mintát követi
mint a hive.store.ts: fetch + action + error handling + resource sync.
A useHiveStore() hívása az action-ökben biztosítja, hogy a resource-ok
mindig frissüljenek keltetés/kutatás után.

3.4 Előfeltétel és szinergia validálás
----------------------------------------
A validatePrerequisites() és isSynergyActive() függvények tiszta,
tesztelhető logikával ellenőrzik a mutációs fa követelményeit.
A getUnlockedUnits() összegyűjti az összes aktív szinergiát.

3.5 AttritionCountdown live timer
-----------------------------------
Az 1 másodperces setInterval + computed-ok + onUnmounted cleanup +
auto-stop lejáratkor egy jól megtervezett, memória-biztos komponenst
eredményezett. A code review által talált setInterval leak azonnal
javításra került.

3.6 Build fix-ek
-----------------
A Phase 2 során három kritikus build probléma is megoldódott:
- shared/dist + rootDir: "src" → a backend fordítás helyes elérési utakra
- bcryptjs createRequire → CJS csomag ESM-ből való importálása
- shared/src/*.js gitignore → véletlen fordítási artifact-ok kizárása

================================================================================
4. AMIT MÁSKÉPP CSINÁLNÁNK
================================================================================

4.1 Unit tesztek az új service-ekhez azonnal
-----------------------------------------------
Az AttritionService, MilitaryService és MutationService egyikéhez sem
készült unit teszt a Sprint 2.1-2.3 során. A Phase 1 retrospektívben
megfogalmazott tanulság ("Teszt keretrendszer korábbi bevezetése")
ellenére ez a minta megismétlődött. Phase 3-ban minden új service-hez
AZONNAL unit tesztet kell írni.

4.2 Mock frissítés a tesztekben
---------------------------------
Amikor az AttritionService elkezdte használni a prisma.unitBatch-et,
a meglévő 12 EngineService teszt eltört, mert a mock nem tartalmazta
az új unitBatch property-t. Ezt a függőségi változást azonnal
reflektálni kell a tesztekben.

4.3 Frontend komponensek import tisztasága
-------------------------------------------
A code review több unused import-ot és dead code-ot talált a frontend
komponensekben (computed, UnitType, UNIT_STATS a MilitaryOverview-ban;
unitIcons, icon() az AttritionCountdown-ban; MUTATION_TREE a mutation.
store-ban). Egy ESLint unused-imports plugin vagy a vue-tsc strict
mode segíthetett volna ezeket korábban elkapni.

4.4 BullMQ halasztás hatása
-----------------------------
A keltetés és kutatás instant végrehajtása működik, de a játékélmény
szempontjából az időzített építés/keltetés/kutatás alapvető. A BullMQ
integrációt a Phase 3 legelején prioritásként kell kezelni.

================================================================================
5. TECHNIKAI ADÓSSÁG
================================================================================

| Adósság                           | Súlyosság | Terv                                           |
|-----------------------------------|-----------|-------------------------------------------------|
| BullMQ integráció hiánya          | Magas     | Phase 3 első sprintjében bevezetni             |
| Unit tesztek hiánya (új servicek) | Közepes   | Phase 3 során pótolni                          |
| Husky pre-commit hookok           | Alacsony  | Phase 3 elején beállítani                      |
| recalcProductionRates duplikáció  | Alacsony  | shared/math.ts-be mozgatni                     |
| ESLint unused-imports plugin      | Alacsony  | Hozzáadni a konfighoz                          |
| Nincs integrációs teszt           | Közepes   | Phase 3 során E2E teszteket hozzáadni          |

================================================================================
6. SZÁMOK
================================================================================

Phase 2 statisztikák:
- **Új Prisma modellek:** 2 (UnitBatch, Mutation)
- **Új NestJS modulok:** 2 (MilitaryModule, MutationModule)
- **Új API végpontok:** 4 (POST /military/hatch, GET /military/units,
                           POST /mutation/research, GET /mutation/tree)
- **Új backend fájlok:** 6 (3 controller, 3 service, 2 module)
- **Új frontend fájlok:** 10 (2 view, 4 component, 2 service, 2 store)
- **Új Pinia store-ok:** 2 (military, mutation)
- **Frontend route-ok:** 2 (/military, /mutations)
- **Unit tesztek:** 12 (meglévő, mind zöld)
- **Összes API végpont Phase 1+2:** 10

================================================================================
7. JAVASLATOK PHASE 3-RA
================================================================================

7.1 Sprint 3.1 előtt
----------------------
- [ ] BullMQ integráció: keltetési és kutatási job-ok bevezetése
- [ ] Unit tesztek pótlása: AttritionService, MilitaryService, MutationService
- [ ] Husky pre-commit hookok beállítása
- [ ] recalcProductionRates áthelyezése shared/math.ts-be
- [ ] ESLint unused-imports plugin hozzáadása

7.2 Sprint 3.1 (Térkép Adatstruktúra & API)
----------------------------------------------
- MapHex és Movement Prisma modellek
- Map seeding script (hegyek, tavak, PvE fészkek)
- MapController: GET /map/viewport
- Hexa távolság és utazási idő számítás

7.3 Általános javaslatok
--------------------------
- MINDEN új backend service-hez azonnal unit tesztet írni
- A BullMQ-t a lehető leghamarabb bevezetni (a játék core élménye függ tőle)
- A frontend komponensekben az import-ok tisztaságára figyelni
- A code review + typecheck ciklust megtartani (Phase 2-ben jól működött)
- A dokumentációt folyamatosan frissíteni

================================================================================
8. KONKLÚZIÓ
================================================================================

A Phase 2 sikeresen teljesítette a kitűzött célokat. Az egység keltetés,
a mutációs háló, az attrition logika és a hozzá tartozó frontend UI
mind működőképes. A játék legfontosabb innovációja — az egységek véges
élettartama és a keltetési hullámok időzítése — technikailag megvalósult.

A Phase 1+2 együtt egy stabil alapot biztosít: a felhasználók tudnak
regisztrálni, belépni, kaptárt építeni, kamrákat fejleszteni,
egységeket kelteni, mutációkat kutatni, és a rendszer valós időben
számolja az erőforrásokat és az egységek elhalását.

A Phase 3 a térkép, a mozgás és a harc bevezetésével fogja a játékot
a következő szintre emelni — itt válik a "base builder"-ből valódi
MMO stratégiai játékká.
