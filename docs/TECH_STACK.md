================================================================================
                    TECH STACK: A RAJ
================================================================================

Dokumentum célja: A választott technológiák részletes leírása, verziói,
és a választás indoklása.

Verzió: 1.1 (Phase 1 utáni frissítés)
Utolsó frissítés: 2026-06-19

================================================================================
1. STACK ÖSSZEFOGLALÓ: "TS-Hive"
================================================================================

A "TS-Hive" egy full-stack TypeScript monorepo architektúra, amely a
következő fő komponensekből áll:

  shared/       – Megosztott TypeScript kód (interfészek, formulák, konstansok)
  backend/      – NestJS szerver (Node.js)
  frontend/     – Vue 3 SPA + PWA (Vite)

================================================================================
2. BACKEND
================================================================================

2.1 Futtatókörnyezet: Node.js
------------------------------------------------
Verzió: Node.js 24.17
Indoklás:
  - Teljes TypeScript támogatás
  - Aszinkron I/O miatt kiváló WebSocket és valós idejű teljesítmény
  - Hatalmas package ecosystem
  - A NestJS natív runtime-ja

2.2 Keretrendszer: NestJS
------------------------------------------------
Verzió: NestJS 11+
Indoklás:
  - Moduláris architektúra (modulok, controllerek, service-ek)
  - Beépített WebSocket támogatás (@WebSocketGateway)
  - Dependency injection – tesztelhetőség
  - Guardok, interceptorsek, pipe-ok – tiszta kód
  - BullMQ és Redis natív integráció
  - TypeScript first

2.3 ORM: Prisma
------------------------------------------------
Verzió: Prisma 6.15
Indoklás:
  - Type-safe adatbázis lekérdezések
  - Automatikus migrációk
  - PostgreSQL natív támogatása
  - $transaction – ACID garancia (kritikus a harcnál!)
  - Kompozit kulcsok támogatása (MapHex: q, r)

2.4 Adatbázis: PostgreSQL
------------------------------------------------
Verzió: PostgreSQL 17
Indoklás:
  - ACID compliance – "semmi sem tűnhet el" (GDD követelmény)
  - JSONB támogatás (payload, detailsJson)
  - Indexek (hexa viewport, lastUpdated)
  - Row-level locking ($transaction)
  - Skálázható

2.5 Cache / Message Queue: Redis + BullMQ
------------------------------------------------
Verzió: Redis 7, BullMQ
Indoklás:
  - BullMQ: Pontos késleltetett job-ok (támadás érkezés, keltetés vége)
  - Redis: Session tárolás, ranglisták, rate limiting
  - Redis Pub/Sub: Skálázható WebSocket broadcast (több szerver esetén)
  - AOF persistence: Redis adatvesztés ellen

2.6 Tesztelés: Jest + ts-jest
------------------------------------------------
Verzió: Jest 30+, ts-jest
Indoklás:
  - NestJS @nestjs/testing natív Jest támogatása
  - ts-jest ESM módban működik a NestJS decorator-okkal
  - 12 unit teszt az EngineService-hez, mind zöld
  - Külön tsconfig.spec.json a teszt fájlokhoz

2.7 WebSocket: Socket.io
------------------------------------------------
Verzió: Socket.io 4
Indoklás:
  - Room-ok: klán chat, privát üzenetek
  - Auto-reconnect
  - JWT autentikáció kapcsolódáskor
  - Fallback HTTP long-polling (ha a WebSocket nem elérhető)
  - NestJS natív @WebSocketGateway támogatás

================================================================================
3. FRONTEND
================================================================================

3.1 Keretrendszer: Vue.js 3
------------------------------------------------
Verzió: Vue 3.5+ (Composition API)
Indoklás:
  - Könnyű, gyors – Canvas renderelésnél fontos
  - Composition API: tiszta, újrahasználható kód
  - Pinia: State management
  - Vue Router: Oldal navigáció
  - Kiváló TypeScript támogatás

3.2 Build Tool: Vite
------------------------------------------------
Verzió: Vite 6+
Indoklás:
  - Villámgyors HMR (Hot Module Replacement)
  - Beépített TypeScript támogatás
  - VitePWA plugin a PWA funkciókhoz
  - Tree shaking, code splitting

3.3 CSS: TailwindCSS
------------------------------------------------
Verzió: TailwindCSS 4 (@tailwindcss/vite plugin)
Indoklás:
  - Gyors prototípus
  - Nincs dark: prefix (v4 natív sötét téma támogatás)
  - Reszponzív design (sm:, md:, lg: prefixek)
  - Testreszabható színek (organikus paletta)

3.4 PWA: VitePWA
------------------------------------------------
Verzió: vite-plugin-pwa
Indoklás:
  - Mobil-first követelmény (GDD)
  - Offline cache (service worker)
  - Telepíthető mobil ikon
  - Push értesítések (jövőbeli funkció)

3.5 Térkép Renderelés: HTML5 Canvas
------------------------------------------------
Indoklás:
  - Hexa grid nagy teljesítményű renderelése
  - Egyedi animációk (pulzálás, feromon görbék)
  - WebGL-re frissíthető (PixiJS) ha kell
  - Nincs külső függőség

================================================================================
4. DEVOPS & INFRASTRUKTÚRA
================================================================================

4.1 Container: Docker + Docker Compose
------------------------------------------------
Verzió: Docker 27+
Indoklás:
  - Konzisztens fejlesztői környezet
  - PostgreSQL + Redis együtt indítása
  - Könnyű deploy
  - Környezeti változók (.env)

4.2 CI/CD: GitHub Actions (tervezett)
------------------------------------------------
  - TypeScript type check
  - ESLint + Prettier
  - Unit tesztek (Vitest)
  - Docker image build
  - Deploy automatizálás

4.3 Monitoring (Phase 6, tervezett)
------------------------------------------------
  - Winston / Pino: Strukturált loggolás
  - Bull Board: Queue monitorozás
  - Prometheus + Grafana: Metrikák (opcionális)

================================================================================
5. MONOREPO STRUKTÚRA
================================================================================

/a-raj-monorepo
 ├── package.json            (workspaces: ["shared", "backend", "frontend"])
 ├── tsconfig.base.json      (közös TypeScript konfiguráció)
 ├── docker-compose.yml      (PostgreSQL + Redis)
 ├── .env                    (közös környezeti változók)
 ├── /shared
 │   ├── package.json
 │   ├── tsconfig.json
 │   ├── src/
 │   │   ├── constants.ts    (UNIT_LIFESPAN, BUILD_COSTS, etc.)
 │   │   ├── math.ts         (hexDistance, attritionCalc, travelTime)
 │   │   ├── types.ts        (IHive, IUnitBatch, IMovement stb.)
 │   │   └── enums.ts        (ChamberType, UnitType, DamageType)
 ├── /backend
 │   ├── package.json
 │   ├── tsconfig.json
 │   ├── nest-cli.json
 │   ├── prisma/
 │   │   └── schema.prisma
 │   ├── src/
 │   │   ├── main.ts
 │   │   ├── app.module.ts
 │   │   ├── auth/
 │   │   ├── engine/
 │   │   ├── hive/
 │   │   ├── military/
 │   │   ├── map/
 │   │   ├── clan/
 │   │   ├── combat/
 │   │   ├── jobs/
 │   │   └── websocket/
 └── /frontend
     ├── package.json
     ├── tsconfig.json
     ├── vite.config.ts
     ├── index.html
     ├── public/
     │   └── manifest.json
     └── src/
         ├── main.ts
         ├── App.vue
         ├── router/
         ├── stores/         (Pinia)
         ├── components/
         ├── views/
         ├── composables/
         ├── utils/
         └── assets/
