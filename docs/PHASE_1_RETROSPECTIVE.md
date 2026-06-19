================================================================================
                    PHASE 1 RETROSPECTIVE: A RAJ
================================================================================

Dokumentum célja: A Phase 1 (Minimum Viable Hive) teljes körű retrospektív
elemzése — mi készült el, mi változott a tervhez képest, milyen tanulságok
születtek, és mik a javaslatok a Phase 2-re.

Verzió: 1.0
Dátum: 2026-06-19

================================================================================
1. ÖSSZEFOGLALÓ
================================================================================

A Phase 1 célja egy működő MVP (Minimum Viable Product) létrehozása volt,
ami tartalmazza az autentikációt, a kaptár építést, a lazy erőforrás
számítást, és a hozzá tartozó frontend UI-t.

Eredmény: ✅ Phase 1 TELJES — minden tervezett funkció implementálva,
a typecheck zöld, a unit tesztek átmennek, a seed adatbázis működik.

Idővonal:
  Sprint 1.1 — Projekt inicializálás        ✅
  Sprint 1.2 — Autentikáció & PWA           ✅
  Sprint 1.3 — Kaptár Core & Lazy Calc      ✅
  Sprint 1.3b — Seed & Tesztek              ✅ (extra sprint)
  Sprint 1.4 — Kaptár UI                    ✅

================================================================================
2. TERV vs. VALÓSÁG
================================================================================

2.1 Ami az eredeti terv szerint készült el
--------------------------------------------
- Monorepo (shared/, backend/, frontend/) npm workspaces-szel
- Docker Compose: PostgreSQL 17 + Redis 7
- NestJS 11 backend moduláris felépítéssel
- Prisma ORM + migrációk
- JWT autentikáció (register, login, refresh, logout)
- Lazy Calculation Engine (updateHiveState)
- Nyersanyag termelés számítás (Gombakert, Gyökér-Szívó, Hőkamra)
- Hő egyensúly rendszer heat starvation-nel
- Storage kapacitás (Emésztő Verem)
- Kamra építés/fejlesztés költség validálással
- Vue 3 + Vite + TailwindCSS 4 frontend
- PWA támogatás (VitePWA plugin)
- Kaptár UI (ResourceBar, ChamberCard, BuildQueue, HiveView)
- requestAnimationFrame alapú kliens-oldali resource ticker

2.2 Ami az eredeti terven felül készült el
--------------------------------------------
- RefreshToken Prisma modell SHA-256 hash-eléssel
- PrismaModule + PrismaService (globális NestJS modul)
- Axios auto-refresh interceptor (401 -> automatikus token frissítés)
- Token rotáció (minden refresh új tokent generál)
- Logout API (refresh tokenek visszavonása)
- Seed fájl (3 teszt user, 3 kaptár)
- 12 unit teszt az EngineService-hez (Jest)
- recalcProductionRates() a frontend store-ban (upgrade utáni azonnali UI frissítés)
- ChamberDefinition típus (Record<ChamberType, ChamberDefinition>)
- tsconfig.spec.json (külön tsconfig a teszt fájloknak)

2.3 Ami eltért az eredeti tervtől
-----------------------------------
| Terv                                | Valóság                                     | Indoklás                          |
|-------------------------------------|---------------------------------------------|-----------------------------------|
| Node.js 22 LTS                      | Node.js 24.17                               | Fejlesztői gépen elérhető verzió  |
| Prisma 7+                           | Prisma 6.15                                 | npm registry aktuális stabil      |
| Vitest a CI/CD-hez                  | Jest (backend), nincs CI/CD még             | NestJS jobban támogatja a Jest-et |
| TailwindCSS dark: prefix            | TailwindCSS v4 (@tailwindcss/vite plugin)   | Tailwind v4 más konfigurációt     |
|                                            |                                              | használ (nincs dark: prefix)      |
| ESLint + Prettier config            | Elhalasztva                                  | Fókusz a funkcionalitáson         |
| Husky pre-commit hookok             | Elhalasztva                                  | Fókusz a funkcionalitáson         |
| Session middleware                  | JWT-only (nincs session)                    | A JWT guard + strategy elég       |
| User.email mező                     | Nincs email (csak username)                 | GDD nem követeli meg az email-t   |
| Monorepo struktúrában BottomNav,    | AppShell-be integrált navigáció             | Egyszerűbb, kevesebb fájl         |
| Sidebar, guards.ts külön fájlok     |                                              |                                   |
| BullMQ build/heckleton queue        | Instant építés (BullMQ Phase 2-re halasztva)| MVP fókusz                        |

2.4 Ami kimaradt / el lett halasztva
--------------------------------------
| Elem                               | Státusz         | Tervezett fázis |
|------------------------------------|-----------------|-----------------|
| ESLint + Prettier konfiguráció     | Elhalasztva     | Phase 2 eleje   |
| Husky pre-commit hookok            | Elhalasztva     | Phase 2 eleje   |
| BullMQ integráció (építési idő)    | Elhalasztva     | Sprint 2.2      |
| AttritionService éles implementáció| Hook kész       | Sprint 2.1      |
| UnitBatch Prisma modell            | Nincs           | Sprint 2.1      |
| Mutation Prisma modell             | Nincs           | Sprint 2.1      |
| Email mező                         | Nincs           | Opcionális       |
| README.md                          | Nincs           | Phase 2         |

================================================================================
3. AMI JÓL MŰKÖDÖTT
================================================================================

3.1 TypeScript monorepo
------------------------
A shared/ mappa használata kiváló döntés volt. A típusok, konstansok és
matematikai formulák megosztása a frontend és backend között:
- Eliminálta a duplikációt
- Biztosította a konzisztenciát (pl. ChamberType enum mindenhol ugyanaz)
- A calculateBuildCost és calculateCurrentResources mindkét oldalon elérhető

3.2 Lazy Calculation pattern
-----------------------------
A "NE cron job" elv tökéletesen működik:
- EngineService.updateHiveState() pontosan azt csinálja amit kell
- A unit tesztek igazolják a helyességet
- A heat starvation soft degradation jól kiegyensúlyozott
- A storage clamping megfelelően működik

3.3 Prisma $transaction
------------------------
Az upgradeChamber implementációja atomi tranzakcióban végzi a
költséglevonást és a kamra létrehozását/fejlesztését. Ez kritikus
az adatintegritás szempontjából.

3.4 Code review folyamat
--------------------------
Minden sprint végén code-reviewer-deepseek review + typecheck:
- Több hibát fogott meg még a commit előtt
- A típushibák, felesleges castok, elnevezési problémák azonnal javításra kerültek
- A review-k minősége konzisztens volt

3.5 Refresh token biztonság
-----------------------------
Az SHA-256 hash-elés + token rotáció + logout érvénytelenítés jól
implementált. A bcrypt nem-determinisztikus jellegét felismerve
SHA-256-ra váltottunk, ami lehetővé teszi a hash alapú visszakeresést.

================================================================================
4. AMIT MÁSKÉPP CSINÁLNÁNK
================================================================================

4.1 Teszt keretrendszer korábbi bevezetése
--------------------------------------------
A Jest konfigurációt és a unit teszteket már a Sprint 1.3 elején be
kellett volna vezetni, nem egy külön Sprint 1.3b-ben. A tesztek
korábbi jelenléte segített volna a heat starvation bug-ok korai
felismerésében.

4.2 ESLint/Prettier korábbi bevezetése
----------------------------------------
A kód stílusának konzisztens betartatása már az első sprinttől hasznos
lett volna. A Phase 2 első feladatai közé kell venni.

4.3 recalcProductionRates duplikáció
--------------------------------------
A frontend hive.store.ts-ben lévő recalcProductionRates() függvény
duplikálja a backend ProductionService logikáját. Ezt jobb lenne a
shared/math.ts-be kiszervezni, hogy egy helyen legyen definiálva.

================================================================================
5. TECHNIKAI ADÓSSÁG
================================================================================

| Adósság                           | Súlyosság | Terv                                           |
|-----------------------------------|-----------|-------------------------------------------------|
| ESLint/Prettier hiánya            | Közepes   | Phase 2 első sprintjében pótolni               |
| recalcProductionRates duplikáció  | Alacsony  | Phase 2 során shared-be mozgatni               |
| BuildQueue placeholder            | Alacsony  | Sprint 2.2-ben BullMQ-val élesíteni            |
| AttritionService no-op            | Alacsony  | Sprint 2.1-ben UnitBatch modellel feltölteni   |
| `as` cast-ok a chamber típusoknál| Alacsony  | Fokozatosan kivezetni a strict típusokkal      |
| Nincs integrációs teszt           | Közepes   | Phase 2 során E2E teszteket hozzáadni          |
| Nincs README                      | Alacsony  | Phase 2 során létrehozni                       |

================================================================================
6. SZÁMOK
================================================================================

- **Fájlok:** ~45 forráskód fájl (.ts, .vue, .prisma, .css)
- **Prisma modellek:** 4 (User, Hive, Chamber, RefreshToken)
- **API végpontok:** 6 (register, login, refresh, logout, GET /hive, POST /hive/upgrade)
- **Shared fájlok:** 5 (enums, types, constants, math, index)
- **Unit tesztek:** 12 (mind zöld)
- **Seed adatok:** 3 user, 3 kaptár, 13 kamra
- **TypeScript konfigurációk:** 5 (tsconfig.base.json, shared/, backend/, backend spec, frontend/)
- **Frontend komponensek:** 9 (AppShell, HomeView, LoginView, RegisterView, HiveView, MapView placeholder, ResourceBar, ChamberCard, BuildQueue)
- **Pinia store-ok:** 2 (auth, hive)
- **Node.js csomagok:** ~1020 (összes workspace)

================================================================================
7. JAVASLATOK PHASE 2-RE
================================================================================

7.1 Sprint 2.1 előtt
----------------------
- [ ] ESLint + Prettier konfiguráció hozzáadása
- [ ] recalcProductionRates áthelyezése shared/math.ts-be
- [ ] README.md létrehozása

7.2 Sprint 2.1 (Unit System)
-------------------------------
- UnitBatch és Mutation Prisma modellek hozzáadása
- AttritionService éles implementációja
- Az attrition hook csatlakoztatása az updateHiveState-hez
- Unit tesztek az AttritionService-hez

7.3 Általános javaslatok
--------------------------
- Minden új backend service-hez azonnal unit tesztet írni (ne külön sprintben)
- A BullMQ integrációt a Sprint 2.2-ben prioritásként kezelni
- A shared/math.ts függvényeket használni mindenhol a duplikáció elkerülésére
- A code review + typecheck ciklust minden sprint végén megtartani
- A dokumentációt (PHASE_TASKS.md) folyamatosan frissíteni

================================================================================
8. KONKLÚZIÓ
================================================================================

A Phase 1 sikeresen teljesítette a kitűzött célokat. Az MVP működőképes:
a felhasználók tudnak regisztrálni, belépni, kaptárt építeni, kamrákat
fejleszteni, és a rendszer valós időben számolja és jeleníti meg az
erőforrásokat. Az architektúra stabil alapot biztosít a Phase 2-höz,
ami az egységrendszer és az attrition bevezetésével a játék
legfontosabb innovációját fogja megvalósítani.
