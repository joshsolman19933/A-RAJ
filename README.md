# A RAJ

**Böngészős MMO Stratégiai Játék (Base-builder)**

Organikus sci-fi világban építesz földalatti idegen kaptárt húsból és nyálkából. A Travianhoz hasonló, de a legnagyobb különbség: a sereged nem él örökké — a rovarszerű katonáid pár nap alatt elhalnak. A sikeres invázió titka a tökéletesen időzített keltetési hullám.

---

## Stack

| Réteg       | Technológia                        |
|-------------|-----------------------------------|
| Backend     | NestJS 11 + TypeScript            |
| ORM         | Prisma 6 + PostgreSQL 17          |
| Cache/Queue | Redis 7 + BullMQ                  |
| Frontend    | Vue 3 (Composition API) + Vite 6  |
| CSS         | TailwindCSS 4                     |
| PWA         | VitePWA plugin                    |
| Testing     | Jest 30 + ts-jest                 |
| DevOps      | Docker Compose                    |

Monorepo: `npm` workspaces (`shared/`, `backend/`, `frontend/`)

---

## Quick Start

### Előfeltételek

- Node.js 24+
- Docker Desktop
- npm 11+

### Telepítés

```bash
# Függőségek telepítése
npm install

# Docker szolgáltatások indítása (PostgreSQL + Redis)
docker compose up -d

# Adatbázis migráció
npm run db:migrate -w backend

# Seed adatok (3 teszt user, jelszó: test123)
npm run db:seed -w backend
```

### Fejlesztés

```bash
# Backend + Frontend egyidejű indítása
npm run dev

# Vagy külön:
npm run dev -w backend    # NestJS szerver (http://localhost:3000)
npm run dev -w frontend   # Vite dev szerver (http://localhost:5173)
```

### Tesztelés

```bash
# Unit tesztek
npm run test -w backend

# TypeScript típusellenőrzés
npm run typecheck
```

---

## API Dokumentáció

A backend indulása után a Swagger UI elérhető:

**http://localhost:3000/api/docs**

### Elérhető végpontok (Phase 1)

| Method | URL              | Leírás                          |
|--------|------------------|----------------------------------|
| POST   | `/api/auth/register` | Regisztráció                |
| POST   | `/api/auth/login`    | Bejelentkezés (JWT)         |
| POST   | `/api/auth/refresh`  | JWT token frissítés         |
| POST   | `/api/auth/logout`   | Refresh token visszavonás   |
| GET    | `/api/hive`          | Kaptár állapot lekérése     |
| POST   | `/api/hive/upgrade`  | Kamra építés/fejlesztés     |

---

## Projekt Struktúra

```
/a-raj
├── shared/            # Megosztott TypeScript (interfészek, formulák, konstansok)
│   └── src/
│       ├── enums.ts       # ChamberType, UnitType, stb.
│       ├── types.ts       # HiveData, Resources, ChamberData, stb.
│       ├── constants.ts   # Egység statok, épület definíciók, játékegyensúly
│       └── math.ts        # Hexa távolság, termelés számítás, attrition
├── backend/           # NestJS szerver
│   ├── prisma/
│   │   ├── schema.prisma  # Adatbázis modellek
│   │   └── seed.ts        # Teszt adatok
│   └── src/
│       ├── auth/          # JWT autentikáció
│       ├── engine/        # Lazy Calculation motor
│       ├── hive/          # Kaptár kezelés (kamrák)
│       ├── prisma/        # PrismaModule + PrismaService
│       └── main.ts
├── frontend/          # Vue 3 SPA + PWA
│   └── src/
│       ├── views/         # Oldal komponensek (HiveView, MapView, stb.)
│       ├── components/    # Újrahasználható komponensek
│       │   ├── layout/    # AppShell
│       │   └── hive/      # ResourceBar, ChamberCard, BuildQueue
│       ├── stores/        # Pinia store-ok (auth, hive)
│       ├── services/      # API hívások (auth, hive)
│       └── router/        # Vue Router
└── docs/              # Dokumentáció
    ├── GDD.md             # Game Design Document
    ├── IMPLEMENTATION_PLAN.md
    ├── PHASE_TASKS.md
    ├── TECH_STACK.md
    ├── FILE_STRUCTURE.md
    └── PHASE_1_RETROSPECTIVE.md
```

---

## Fejlesztési Státusz

| Phase | Státusz  |
|-------|----------|
| 1 — MVP Core Loop | ✅ Complete |
| 2 — The Hatching  | ⬜ Tervezett |
| 3 — World Map     | ⬜ Tervezett |
| 4 — Swarm & Clans | ⬜ Tervezett |
| 5 — Expansion     | ⬜ Tervezett |
| 6 — Polish & Launch | ⬜ Tervezett |

Részletes task lista: [`docs/PHASE_TASKS.md`](docs/PHASE_TASKS.md)

---

## Licensz

All rights reserved.
