================================================================================
                    FILE STRUCTURE: A RAJ
================================================================================

Dokumentum célja: A monorepo részletes fájlstruktúrája, mappák és fájlok
szerepének leírásával.

Verzió: 1.1 (Phase 1 utáni frissítés)
Utolsó frissítés: 2026-06-19

================================================================================
1. GYÖKÉR
================================================================================

/a-raj-monorepo/
 ├── package.json              Workspace definíció (npm/yarn workspaces)
 ├── tsconfig.base.json        Közös TypeScript beállítások
 ├── docker-compose.yml        PostgreSQL + Redis + (opcionális) Adminer
 ├── .env                      Környezeti változók
 ├── .gitignore
 ├── README.md
 ├── docs/                     Dokumentációk
 │   ├── GDD.md
 │   ├── IMPLEMENTATION_PLAN.md
 │   ├── PHASE_TASKS.md
 │   ├── TECH_STACK.md
 │   ├── FILE_STRUCTURE.md
 │   └── PHASE_1_RETROSPECTIVE.md
 ├── shared/                   Megosztott kód (frontend + backend)
 ├── backend/                  NestJS szerver
 └── frontend/                 Vue 3 SPA + PWA

================================================================================
2. SHARED
================================================================================

shared/
 ├── package.json
 ├── tsconfig.json
 └── src/
     ├── index.ts              Barrel export
     ├── constants.ts          UNIT_LIFESPAN, BUILD_COSTS, PRODUCTION_RATES
     ├── math.ts               hexDistance(), travelTime(), attritionCheck()
     ├── types.ts              IHive, IUnitBatch, IMovement, ICombatReport
     └── enums.ts              ChamberType, UnitType, DamageType, FeromonType

================================================================================
3. BACKEND
================================================================================

backend/
 ├── package.json              NestJS, Prisma, BullMQ, Socket.io stb.
 ├── tsconfig.json
 ├── tsconfig.spec.json        TypeScript konfiguráció teszt fájlokhoz
 ├── jest.config.ts            Jest ESM konfiguráció
 ├── nest-cli.json
 ├── Dockerfile
 ├── .env                      Prisma DATABASE_URL
 ├── prisma/
 │   ├── schema.prisma         Adatbázis modellek (User, Hive, Chamber, RefreshToken)
 │   ├── migrations/           Prisma migrációk
 │   └── seed.ts               Seed adatok (3 user, 3 kaptár, 13 kamra)
 └── src/
     ├── main.ts               Bootstrap (NestJS app, Swagger, CORS)
     ├── app.module.ts         Fő modul
     │
     ├── auth/                 JWT autentikáció
     │   ├── auth.module.ts
     │   ├── auth.controller.ts    POST /register, /login, /refresh, /logout
     │   ├── auth.service.ts       SHA-256 refresh token hash, token rotáció
     │   ├── jwt.strategy.ts
     │   ├── jwt-auth.guard.ts
     │   └── dto/              LoginDto, RegisterDto, RefreshDto
     │
     ├── engine/               Lazy Calculation motor
     │   ├── engine.module.ts
     │   ├── engine.service.ts     updateHiveState(), lazy calculation motor
     │   ├── engine.service.spec.ts 12 unit teszt
     │   ├── production.service.ts Termelési ráták, heat starvation, storage cap
     │   └── attrition.service.ts  Egység élettartam ellenőrzés (hook)
     │
     ├── hive/                 Kaptár kezelés
     │   ├── hive.module.ts
     │   ├── hive.controller.ts    GET /hive, POST /hive/upgrade (+UpgradeChamberDto)
     │   └── hive.service.ts       Lazy hive creation, $transaction upgrade
     │
     ├── military/             Sereg kezelés
     │   ├── military.module.ts
     │   ├── military.controller.ts POST /military/hatch, GET /military/units
     │   ├── military.service.ts
     │   ├── unit-batch.service.ts  UnitBatch CRUD
     │   ├── mutation.service.ts    Mutációs háló logika
     │   └── dto/              HatchDto, ResearchDto
     │
     ├── map/                  Térkép
     │   ├── map.module.ts
     │   ├── map.controller.ts     GET /map/viewport
     │   ├── map.service.ts
     │   └── hex-utils.ts         Hexa koordináta segédfüggvények
     │
     ├── combat/               Harc szimuláció
     │   ├── combat.module.ts
     │   ├── combat.service.ts     resolveCombat() $transaction
     │   ├── combat.controller.ts  GET /combat/reports
     │   └── dto/              SendMovementDto
     │
     ├── movement/             Mozgás kezelés
     │   ├── movement.module.ts
     │   ├── movement.controller.ts POST /movement/send, GET /movement/active
     │   └── movement.service.ts
     │
     ├── clan/                 Klán rendszer
     │   ├── clan.module.ts
     │   ├── clan.controller.ts
     │   ├── clan.service.ts
     │   ├── diplomacy.service.ts
     │   └── feromon.service.ts    Feromon nyomok kezelése
     │
     ├── queen/                Királynő képzés és rajzás
     │   ├── queen.module.ts
     │   ├── queen.controller.ts
     │   └── queen.service.ts
     │
     ├── jobs/                 BullMQ feldolgozók
     │   ├── jobs.module.ts
     │   ├── combat.processor.ts     Harc végrehajtás
     │   ├── build.processor.ts      Építés befejezése
     │   ├── hatch.processor.ts      Keltetés befejezése
     │   ├── research.processor.ts   Kutatás befejezése
     │   ├── queen.processor.ts      Királynő képzés befejezése
     │   └── return.processor.ts     Visszaút kezelés
     │
     ├── websocket/            Valós idejű kommunikáció
     │   ├── websocket.module.ts
     │   ├── websocket.gateway.ts   Socket.io gateway (JWT auth, room-ok)
     │   └── dto/              WsEventDto
     │
     ├── premium/              Monetizáció
     │   ├── premium.module.ts
     │   ├── premium.controller.ts
     │   ├── premium.service.ts
     │   └── payment/          Stripe integráció
     │
     ├── common/               Megosztott backend segédek
     │   ├── decorators/       @CurrentUser, @Roles
     │   ├── filters/          HttpExceptionFilter
     │   ├── interceptors/     TransformInterceptor
     │   └── pipes/            ValidationPipe
     │
     └── config/               Konfiguráció
         ├── database.config.ts
         ├── redis.config.ts
         └── jwt.config.ts

================================================================================
4. FRONTEND
================================================================================

frontend/
 ├── package.json              Vue 3, Vite, TailwindCSS, Socket.io-client
 ├── tsconfig.json
 ├── vite.config.ts            VitePWA plugin, alias-ok
 ├── index.html
 ├── Dockerfile
 ├── public/
 │   ├── manifest.json         PWA manifest
 │   ├── icons/                PWA ikonok (192, 512)
 │   └── favicon.png
 └── src/
     ├── main.ts               Vue app inicializálása
     ├── App.vue               Gyökér komponens
     │
     ├── router/               Vue Router
     │   └── index.ts          Útvonalak + auth guard (beforeEach)
     │
     ├── stores/               Pinia state management
     │   ├── auth.store.ts        Felhasználó, JWT token
     │   ├── hive.store.ts        Kaptár állapot (erőforrások, kamrák)
     │   ├── military.store.ts    Egységek, mutációk
     │   ├── map.store.ts         Térkép viewport, hexák
     │   └── clan.store.ts        Klán adatok, chat
     │
     ├── composables/          Újrahasználható logika
     │   ├── useWebSocket.ts      Socket.io kapcsolat
     │   ├── useResourceTimer.ts  requestAnimationFrame ticker
     │   ├── useHexMap.ts         Canvas hexa renderelés
     │   └── useAttack.ts         Támadás indítás logika
     │
     ├── services/             API hívások
     │   ├── auth.service.ts      Axios instance + auto-refresh interceptor
     │   └── hive.service.ts      GET /hive, POST /hive/upgrade
     │
     ├── views/                Oldal komponensek
     │   ├── LoginView.vue
     │   ├── RegisterView.vue
     │   ├── HiveView.vue         Fő kaptár nézet
     │   ├── MapView.vue          Világtérkép
     │   ├── MilitaryView.vue     Sereg kezelés
     │   ├── MutationView.vue     Mutációs háló
     │   ├── ClanView.vue         Klán kezelés
     │   ├── ReportsView.vue      Harcjelentések
     │   └── SettingsView.vue     Beállítások
     │
     ├── components/           Újrahasználható komponensek
     │   ├── layout/
     │   │   └── AppShell.vue        Layout wrapper (header + mobil bottom nav)
     │   ├── hive/
     │   │   ├── ResourceBar.vue     Erőforrás kijelző
     │   │   ├── ChamberCard.vue     Kamra kártya
     │   │   └── BuildQueue.vue      Építési sor
     │   ├── military/
     │   │   ├── Hatchery.vue        Keltető felület
     │   │   ├── UnitList.vue        Egység lista
     │   │   └── AttritionBar.vue    Élettartam visszaszámláló
     │   ├── map/
     │   │   ├── HexCanvas.vue       Canvas hexa térkép
     │   │   ├── AttackPanel.vue     Támadás modal
     │   │   └── FeromonLayer.vue    Feromon overlay
     │   ├── clan/
     │   │   ├── ClanChat.vue        Klán chat
     │   │   ├── MemberList.vue      Tag lista
     │   │   └── FeromonDrawer.vue   Feromon rajzoló UI
     │   ├── combat/
     │   │   ├── CombatReport.vue    Harcjelentés kártya
     │   │   └── AttackAlert.vue     Bejövő támadás riasztás
     │   └── shared/
     │       ├── LoadingSpinner.vue
     │       ├── ErrorBoundary.vue
     │       └── ConfirmDialog.vue
     │
     ├── utils/                Segédfüggvények
     │   ├── format.ts            Dátum, szám formázás
     │   ├── canvas-hex.ts        Hexa rajzolás Canvas-ra
     │   └── unit-icons.ts        Egység ikonok mapping
     │
     └── assets/               Statikus fájlok
         ├── styles/
         │   └── main.css         TailwindCSS + egyedi organikus témák
         ├── images/
         │   ├── icons/           Egység ikonok, épület ikonok
         │   └── textures/        Organikus háttér textúrák
         └── fonts/               Egyedi bio-sci-fi font (ha van)

================================================================================
