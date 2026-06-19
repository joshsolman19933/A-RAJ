================================================================================
                    PHASE 3 RETROSPECTIVE: A RAJ
================================================================================

Dokumentum célja: A Phase 3 (World Map & Bloodshed) teljes körű retrospektív
elemzése — mi készült el, mi változott a tervhez képest, milyen tanulságok
születtek, és mik a javaslatok a Phase 4-re.

Verzió: 1.0
Dátum: 2026-06-19

================================================================================
1. ÖSSZEFOGLALÓ
================================================================================

A Phase 3 célja a világtérkép (hexagonális grid), a mozgás és a harcrendszer
implementálása volt — itt vált a "base builder"-ből valódi MMO stratégiai
játékká a projekt.

Eredmény: ✅ Phase 3 TELJES — minden tervezett funkció implementálva,
typecheck zöld (shared + backend + frontend), 12 unit teszt továbbra is zöld,
a térkép 7,651 hexával seed-elve.

Idővonal:
  Sprint 3.1 — Térkép Adatstruktúra & API    ✅
  Sprint 3.2 — Térkép Renderelés             ✅
  Sprint 3.3 — Mozgás & Támadás Rendszer     ✅
  Sprint 3.4 — Harc UI & Riportok            ✅

================================================================================
2. TERV vs. VALÓSÁG
================================================================================

2.1 Ami az eredeti terv szerint készült el
--------------------------------------------
- MapHex Prisma modell (kompozit kulcs: @@id([q, r]), type, hiveId?)
- Movement Prisma modell (attackType, targetQ/R, sentAt/arriveAt, units Json)
- Map seed script: 50-radius hex világ, seeded PRNG (seed=42)
- Terep generálás: 10% hegyek, 5% tavak, 3% PvE fészkek, 82% üres
- MapController: GET /map/viewport?qMin=&qMax=&rMin=&rMax=
- MapView.vue HTML5 Canvas hexa térkép
- Kamera pan (drag) és zoom (scroll + gombok, 0.3–3×)
- Hexa renderelés: EMPTY, MOUNTAIN (⛰), LAKE (💧), HIVE (🏠 pulzáló kör), PVE_NEST (👾)
- Kattintás → hexa kiválasztás → info panel
- MovementController: POST /movement/send + GET /movement/active
- CombatService: resolveCombat() $transaction-ben
- Power-ratio harci formula (attackPhysical+attackAcid vs defensePhysical+defenseAcid)
- Rablóhadjárat (RAID): carryingCapacity × 0.5, biomassza/víz/DNS lopás
- Ostrom (SIEGE): max 2 véletlen kamra rombolása
- Acid Gland védelmi bónusz
- PvE fészek combat (preset statokkal)
- CombatReport generálása (losses, loot, chambersDestroyed, isVictory)
- CombatReport.vue — harcjelentés Teleport modal
- AttackPanel.vue — támadás modal (RAID/SIEGE toggle, unit slider-ek)
- AttackNotification.vue — CSS képernyőszél animáció (victory/defeat)
- MapView integráció: "Támadás" gomb a kiválasztott hex-nél
- MilitaryView integráció: aktív mozgások szekció

2.2 Ami az eredeti terven felül készült el
--------------------------------------------
- Orphaned HIVE normalizálás a MapService-ben (hiveId=null esetén type visszaállítása EMPTY-re)
- Canvas onResize kezdeti méretezés (korábban csak resize eseményre futott)
- Kamera automatikus pozícionálás a saját kaptárra (onMounted + watch)
- Debounce-olt viewport betöltés (200ms, 5-hex küszöb)
- Extra teszt PvE fészkek (23 kézzel pozícionált, 3 gyűrűben ~5, ~15, ~25 hexa távolságra)
- Extra teszt userek + kaptárak (test_wasp, test_beetle) — 6 kaptár a térképen
- Map seed db:map-seed script hozzáadva a backend package.json-hez
- Védő áldozatok alkalmazása RAID és SIEGE esetén is (kezdetben csak RAID-nél volt)
- movementId átadása a CombatService-nek (nem broad deleteMany)
- UnitBatchBrief[] → Json Prisma cast (`as unknown as object[]`)
- Előzetes egység törlés eltávolítása a MovementService-ből (combat kezeli)
- frontend/src/lib/unit-labels.ts — közös unit név helper
- hexDistance() használata az AttackPanel travel time számításához
- AttackNotification dupla-pulzálás a defeat animációban
- MapView canvas cleanup: cancelAnimationFrame + clearTimeout onUnmounted
- @wheel (nem .passive) a térkép scroll megelőzéséhez

2.3 Ami eltért az eredeti tervtől
-----------------------------------
| Terv                                | Valóság                                    | Indoklás                          |
|-------------------------------------|--------------------------------------------|-----------------------------------|
| BullMQ combat job ütemezés          | Instant combat resolution                  | BullMQ nincs bevezetve, a core    |
|                                      |                                            | logika $transaction-ben működik   |
| Visszaút ütemezése                  | Nincs (instant resolution)                 | BullMQ deferred                   |
| Földalatti/felszíni réteg váltás    | Elhalasztva                                | Canvas fókusz, réteg = Phase 4    |
| Térképes támadás animáció           | Elhalasztva                                | Mozgó pontok = Phase 4            |
| Érkezési visszaszámláló             | Aktív mozgások lista (MilitaryView)        | Instant combat miatt nem releváns |
| CombatService + MovementService     | CombatService végzi az ÖSSZES egység       | Architecture review után javítva: |
|  külön unit manipulációval          | manipulációt egy $transaction-ben          | az első változatban a Movement    |
|                                      |                                            | Service előre törölte az egysége- |
|                                      |                                            | ket, így a combat nem tudta alkal-|
|                                      |                                            | mazni az áldozatokat              |

2.4 Ami kimaradt / el lett halasztva
--------------------------------------
| Elem                               | Státusz         | Tervezett fázis |
|------------------------------------|-----------------|-----------------|
| BullMQ combat job ütemezés         | Elhalasztva     | Phase 4         |
| Visszaút ütemezése (túlélők)       | Elhalasztva     | Phase 4         |
| Földalatti/felszíni réteg váltás   | Elhalasztva     | Phase 4         |
| Térképes támadás animáció          | Elhalasztva     | Phase 4         |
| Unit tesztek az új service-ekhez   | Nincs           | Phase 4 eleje   |
| (MapService, CombatService,        |                 |                 |
|  MovementService)                  |                 |                 |
| recalcProductionRates duplikáció   | Nincs javítva   | Phase 4         |
| Husky pre-commit hookok            | Elhalasztva     | Phase 4         |
| ESLint + Prettier                  | Elhalasztva     | Phase 4         |

================================================================================
3. AMI JÓL MŰKÖDÖTT
================================================================================

3.1 Prisma $transaction a CombatService-ben
---------------------------------------------
A Phase 2-ben bevált minta továbbfejlesztése: a CombatService.resolveCombat()
egyetlen $transaction-ben végzi az összes egység manipulációt (támadó áldozatok
levonása, védő áldozatok levonása, loot hozzáadás/levonás, kamra rombolás,
movement törlés). Ez garantálja, hogy a combat eredménye atomi — a tranzakció
bármely pontján fellépő hiba esetén az egész művelet visszagördül, megelőzve
az inkonzisztens játékállapotot.

3.2 Canvas renderelés kamerarendszerrel
-----------------------------------------
A MapView.vue HTML5 Canvas alapú hexa térképe hatékony és jól strukturált:
- requestAnimationFrame render loop (folyamatos HIVE pulzálás)
- Kamera pan (mousedown/mousemove/mouseup) és zoom (wheel + gombok)
- Debounce-olt viewport betöltés (csak akkor tölt új adatot, ha a kamera
  több mint 5 hexa távolságot mozdult)
- Automatikus középre állás a saját kaptárra
- Terep típusonként eltérő renderelés (ikonokkal)

3.3 Hatékony térkép seed-elés
-------------------------------
A map seed script 7,651 hexát generál (50 sugarú körben ez pontosan
3×50² + 3×50 + 1 = 7,651), seeded PRNG-vel (seed=42) determinisztikus
világot hoz létre. A batch insert (500 hexa/tranzakció) hatékonyan
tölti fel az adatbázist. A terep eloszlás a célértékektől kevesebb
mint 1%-kal tér el.

3.4 Code review által talált kritikus hibák
---------------------------------------------
A Phase 3 code review-jei több súlyos architekturális hibát is azonosítottak:
- **Combat unit lifecycle bug**: Az első implementációban a MovementService
  előre törölte az egységeket a batch-ekből, mielőtt a CombatService lefutott
  volna. Így a combat nem tudta alkalmazni az áldozatokat, és a túlélő
  egységek soha nem kerültek vissza a kaptárba. A javítás után a CombatService
  egy $transaction-ben kezeli az összes egység állapotot.
- **Broad deleteMany**: A CombatService `deleteMany({ fromHiveId, targetQ,
  targetR })` helyett `delete({ id: movementId })` használata.
- **Canvas @wheel.passive**: A `.passive` modifier megakadályozta az
  `e.preventDefault()` hívást, így a térkép scroll-oldal görgetést okozott.
- **Canvas kezdeti méretezés hiánya**: Az onResize() csak resize eseményre
  volt kötve, az első render előtt nem futott le.

3.5 Shared math függvények a frontenden és backend-en
-------------------------------------------------------
A shared/math.ts függvényei (hexDistance, axialToPixel, pixelToAxial,
calculateTravelTime, sumUnitPower) mind a frontenden (Canvas renderelés,
travel time számítás), mind a backend-en (MovementService, CombatService)
használatban vannak. Ez biztosítja a konzisztenciát — a hexa távolság
mindenhol ugyanúgy van számolva.

3.6 Teleport modalok a frontenden
-----------------------------------
A CombatReport és AttackPanel komponensek a Vue 3 `<Teleport to="body">`
használatával renderelődnek, ami megoldja a z-index és overflow problémákat.
A transition komponensek animált be- és kilépést biztosítanak.

================================================================================
4. AMIT MÁSKÉPP CSINÁLNÁNK
================================================================================

4.1 Combat architektúra elsőre helyesen
-----------------------------------------
A combat unit lifecycle-t (egységek kiküldése → harc → áldozatok → túlélők
visszatérése) az első implementációban elhibáztuk. A MovementService és
CombatService közötti felelősség-megosztást már a tervezési fázisban
tisztázni kellett volna. A "minden egység állapotot a CombatService kezeljen
egy $transaction-ben" minta csak a code review után alakult ki.

*Tanulság:* Komplex, több service-t érintő műveleteknél (mint a combat) előre
definiálni kell az adatfolyamot és a tranzakció határait.

4.2 Unit tesztek azonnal az új service-ekhez
-----------------------------------------------
Ez a Phase 1 és Phase 2 retrospektívekben is szereplő tanulság, és a Phase 3
során is megismétlődött: egyik új backend service-hez (MapService,
CombatService, MovementService) sem készült unit teszt. A meglévő 12
EngineService teszt továbbra is zöld, de az új funkciók tesztfedettsége 0%.

*Tanulság:* A retrospektívek tanulságait nem elég leírni — be is kell
tartani őket. Phase 4-ben az első új service-nél azonnal tesztet kell írni.

4.3 Canvas komponens életciklus kezelése
------------------------------------------
A MapView.vue canvas komponensnél három életciklus hiba is becsúszott:
- `requestAnimationFrame` nem volt leállítva onUnmounted-nál (memória leak)
- `@wheel.passive` miatt a görgetés megelőzése nem működött
- A canvas kezdeti méretezése hiányzott

Ezek a hibák mind a code review során kerültek elő. Egy canvas-alapú
komponens checklist (raf cleanup, event listener cleanup, initial sizing,
passive modifier ellenőrzés) hasznos lenne.

*Tanulság:* Canvas komponenseknél külön figyelmet kell fordítani a böngésző
API-k (requestAnimationFrame, wheel event, resize) helyes kezelésére.

4.4 hexDistance vs. euklideszi távolság
-----------------------------------------
Az AttackPanel.vue első verziója euklideszi távolságot számolt axial
koordinátákon a hexa távolság helyett. Bár a shared/math.ts-ben elérhető
volt a hexDistance() függvény, a fejlesztő a "gyorsabb" Math.sqrt
megoldást választotta, ami helytelen eredményt ad.

*Tanulság:* A shared csomag függvényeit mindig használni kell, még akkor
is, ha egy egyszerűbbnek tűnő alternatíva létezik — a shared függvények
pont azért vannak, hogy a domain-specifikus logika konzisztens legyen.

================================================================================
5. TECHNIKAI ADÓSSÁG
================================================================================

| Adósság                           | Súlyosság | Terv                                           |
|-----------------------------------|-----------|-------------------------------------------------|
| BullMQ integráció hiánya          | Magas     | Phase 4 első sprintjében bevezetni             |
| Unit tesztek hiánya (új servicek) | Közepes   | Phase 4 során pótolni (CombatService,          |
|                                   |           | MovementService, MapService)                    |
| CombatService + MovementService   | Alacsony  | A két service közötti felelősség-megosztást    |
|  felelősség-megosztás tisztázása  |           | dokumentálni, BullMQ bevezetésekor újra átnézni |
| recalcProductionRates duplikáció  | Alacsony  | shared/math.ts-be mozgatni (Phase 1 óta nyitva)|
| ESLint + Prettier + Husky         | Alacsony  | Phase 4 elején beállítani                      |
| Nincs integrációs/E2E teszt       | Közepes   | Phase 4 során E2E teszteket hozzáadni          |
| Canvas komponens best practices   | Alacsony  | Dokumentálni a canvas cleanup checklist-et     |
|  nincs dokumentálva               |           |                                                 |
| MapSeed script nem idempotens     | Alacsony  | deleteMany() először, de nincs partial update  |
|  (mindig töröl és újratölt)      |           | lehetőség                                       |

================================================================================
6. SZÁMOK
================================================================================

Phase 3 statisztikák:
- **Új Prisma modellek:** 2 (MapHex, Movement)
- **Új NestJS modulok:** 3 (MapModule, CombatModule, MovementModule)
- **Új API végpontok:** 3 (GET /map/viewport, POST /movement/send,
                           GET /movement/active)
- **Új backend fájlok:** 9 (MapService, MapController, MapModule,
                             CombatService, CombatModule, MovementService,
                             MovementController, MovementModule, map-seed.ts)
- **Új frontend fájlok:** 10 (map.service, map.store, movement.service,
                               movement.store, CombatReport.vue,
                               AttackPanel.vue, AttackNotification.vue,
                               unit-labels.ts, + 2 view edit)
- **Új Pinia store-ok:** 2 (map, movement)
- **Szerkesztett fájlok:** 4 (MapView.vue, MilitaryView.vue,
                                app.module.ts, PHASE_TASKS.md)
- **Generált hexák:** 7,651 (50-radius világ)
- **Kaptárak a térképen:** 6 (4 seed + 2 extra teszt)
- **PvE fészkek:** 242 (219 seed + 23 kézi)
- **Unit tesztek:** 12 (meglévő, mind zöld — nincs új)
- **Canvas renderelő motor:** ~350 sor (MapView.vue)
- **Összes API végpont Phase 1+2+3:** 13
- **Összes Prisma modell:** 8 (User, Hive, Chamber, RefreshToken,
                                UnitBatch, Mutation, MapHex, Movement)

================================================================================
7. JAVASLATOK PHASE 4-RE
================================================================================

7.1 Sprint 4.1 előtt
----------------------
- [ ] BullMQ integráció bevezetése (legalább a combat job ütemezéshez)
- [ ] Unit tesztek pótlása: MapService, CombatService, MovementService
- [ ] ESLint + Prettier + Husky konfiguráció
- [ ] recalcProductionRates áthelyezése shared/math.ts-be
- [ ] Canvas komponens best practices dokumentálása

7.2 Sprint 4.1 (Klán Rendszer)
---------------------------------
- Clan, ClanMember Prisma modellek
- ClanController: CRUD + join/leave
- Klán rangok (Vezér/Tiszt/Tag) + jogosultságok
- Diplomáciai rendszer (szövetség, hadüzenet, NAP)
- Belső feromon piac

7.3 Általános javaslatok
--------------------------
- **BullMQ prioritás**: A játék core élménye (időzített támadások, keltetés,
  kutatás) függ a BullMQ-tól. Phase 4-ben ezt NEM szabad tovább halasztani.
- **MINDEN új backend service-hez azonnal unit teszt**: Ez a harmadik
  retrospektív, ami ezt javasolja — Phase 4-ben kötelezővé kell tenni.
- **Canvas komponenseknél**: cleanup checklist (raf, event listeners,
  initial sizing, passive modifiers).
- **Shared függvények használata**: Minden domain-specifikus számításhoz
  (távolság, harci formula, költség) a shared csomag függvényeit kell
  használni — nincs "gyors" helyi implementáció.
- **Code review + typecheck ciklus megtartása**: Phase 3-ban is több
  kritikus hibát fogott meg.
- **Dokumentáció folyamatos frissítése**: PHASE_TASKS.md, retrospektívek.

================================================================================
8. KONKLÚZIÓ
================================================================================

A Phase 3 sikeresen teljesítette a kitűzött célokat. A világtérkép, a
hexagonális grid, a mozgás és a harcrendszer mind működőképes. A játék
most már rendelkezik:

- Egy 7,651 hexás világtérképpel (hegyek, tavak, PvE fészkek, 6 kaptár)
- HTML5 Canvas alapú hexa renderelővel (kamera, zoom, interakció)
- Teljes harcrendszerrel (RAID looting, SIEGE chamber destruction, PvE combat)
- Harc UI-val (támadás panel, combat report modal, képernyőszél animáció)

A Phase 1+2+3 együtt egy jelentős játékot alkot: a felhasználók tudnak
regisztrálni, kaptárt építeni, kamrákat fejleszteni, egységeket kelteni,
mutációkat kutatni, a térképet böngészni, és más kaptárakat/PvE fészkeket
támadni — mindezt valós idejű erőforrás-számítással és egység elhalással.

A Phase 4 a közösségi réteget (klánok, feromon-nyomok, chat, WebSocket)
fogja hozzáadni, ami a játékot az MMO élmény irányába viszi tovább.
A legfontosabb technikai adósság — a BullMQ integráció — a Phase 4
elején prioritásként kezelendő, mivel a játékmenet mélysége (időzített
támadások, keltetési hullámok) ettől függ.
