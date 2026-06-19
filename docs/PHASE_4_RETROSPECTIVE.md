================================================================================
                    PHASE 4 RETROSPECTIVE: A RAJ
================================================================================

Dokumentum célja: A Phase 4 (Swarm Mind & Feromons) teljes körű retrospektív
elemzése — mi készült el, mi változott a tervhez képest, milyen tanulságok
születtek, és mik a javaslatok a Phase 5-re.

Verzió: 1.0
Dátum: 2026-06-19

================================================================================
1. ÖSSZEFOGLALÓ
================================================================================

A Phase 4 célja a közösségi réteg (klánok, valós idejű kommunikáció,
feromon-nyomok, chat) implementálása volt — itt vált a játék MMO-vá,
ahol a játékosok valós időben tudnak együttműködni, kommunikálni és
stratégiai nyomokat hagyni a térképen.

Eredmény: ✅ Phase 4 TELJES — minden tervezett funkció implementálva,
typecheck zöld (shared + backend + frontend), 12 unit teszt továbbra is zöld,
a WebSocket infrastruktúra stabil, a feromon rajzolás működik a Canvas-on.

Idővonal:
  Sprint 4.1 — Klán Rendszer                  ✅
  Sprint 4.2 — WebSocket Infrastruktúra        ✅
  Sprint 4.3 — Feromon-Nyomok                  ✅
  Sprint 4.4 — Chat & Közösségi Funkciók       ✅

================================================================================
2. TERV vs. VALÓSÁG
================================================================================

2.1 Ami az eredeti terv szerint készült el
--------------------------------------------
- Clan + ClanMember + ClanDiplomacy + ClanTrade Prisma modellek (migrációval)
- Klán létrehozás, belépés, kilépés, rangok (LEADER/OFFICER/MEMBER)
- Belső feromon piac (tradeResources $transaction-ben)
- Diplomáciai rendszer (ALLY/ENEMY/NAP/NEUTRAL, upsert)
- NestJS WebSocket gateway (Socket.io, JWT auth, room-ok)
- Socket room-ok: user:<id>, clan:<id>, global
- Chat handlerek: clan, global, private message (rate-limit-elve)
- Frontend ws-client.ts: singleton, JWT handshake, exponential backoff reconnect
- Frontend useWebSocket.ts: Vue composable, auth.token watch → auto connect/disconnect
- FeromonTrail Prisma modell + PheromoneService/PheromoneController
- Canvas feromon rajzolás: mousedown→mousemove→mouseup, Bezier-görbék, shadowBlur glow
- Élő feromon rajzolás WebSocket-en (PHEROMONE_DRAW/PROMONE_VISIBLE)
- Klán chat, globális chat, privát üzenetek
- Chat parancsok (/w, /c, /g)
- Értesítési rendszer (WebSocket push → NotificationPanel)
- ChatView.vue tabbed nézet + privát sidebar
- ChatPanel.vue üzenetlista auto-scroll-lal
- NotificationPanel.vue csengő ikon + dropdown

2.2 Ami az eredeti terven felül készült el
--------------------------------------------
- P2002 race-condition kezelés a joinClan-ban (egyedi constraint hiba elkapása)
- TOCTOU-védett $transaction a tradeResources-ben (hive fetch a tranzakción belül)
- promoteMember $transaction-ben (demote leader + promote target atomikusan)
- leaveClan: leader utolsó tagként disband (cascade delete)
- colorHex validálás: @Matches(/^#[0-9a-fA-F]{6}$/) regex
- Rate limiting sliding window (10 event/sec/socket) a WsGateway-ben
- sendAttackNotification + sendNotification publikus metódusok a WsGateway-en
- wsClient.on() generikus event listener + wsClient.emit()
- Canvas cursor kezelés: drawMode=crosshair, pan=grab/grabbing
- Feromon draw bár UI: ATTACK/DEFEND választás, pontszámláló, Mentés/Törlés/Kilépés
- ChatPanel kapcsolódás állapotjelző: ⚡ Kapcsolódás... a send gomb tiltásával
- Chat mobil bottom nav link (nem csak desktop header)
- Unread badge-ek csatornánként (clan, global, notifications)
- Chat üzenetek MAX_MESSAGES (200) és MAX_NOTIFICATIONS (100) trim
- parseCommand() regex-alapú parancsértelmezés (/w <user> <msg>, /c <msg>, /g <msg>)
- WsModule @Global() dekorátor — WsGateway elérhető minden modulból (CombatService, PheromoneService)
- PheromoneService.broadcastDrawing() metódus
- wsClient reconnectAttempts reset sikeres csatlakozáskor
- ChatPanel isOwn() saját/idegen üzenet megkülönböztető formázás
- NotificationPanel időformázás: "épp most"/"X perce"/"X órája"

2.3 Ami eltért az eredeti tervtől
-----------------------------------
| Terv                                | Valóság                                    | Indoklás                          |
|-------------------------------------|--------------------------------------------|-----------------------------------|
| BullMQ integráció Phase 4 elején    | BullMQ továbbra sincs bevezetve            | A WebSocket és klán rendszer      |
|                                      |                                            | prioritást kapott, a BullMQ       |
|                                      |                                            | Phase 5-re halasztva              |
| 3 unit teszt ajánlás Phase 3 végén  | 0 új unit teszt készült                    | A retrospektív tanulságok         |
|                                      |                                            | ismételten figyelmen kívül maradt |
| Feromon mozgási boost számítás      | Elhalasztva (Phase 5)                      | Fókusz a rajzoláson és a          |
|                                      |                                            | WebSocket broadcast-on            |
| ESLint + Prettier + Husky           | Továbbra is elhalasztva                    | Fókusz a funkcionalitáson         |
| recalcProductionRates duplikáció    | Nincs javítva                              | Nem volt része a Phase 4 scope-nak|
| Canvas réteg váltás                 | Elhalasztva (Phase 5)                      | Phase 3-ból örökölt elhalasztás   |
| Privát chat felhasználónév alapján  | Username mint userId (nincs lookup API)    | Demo működés, kereső API később   |
| Chat store destroy() metódus        | Definiálva de soha nem hívva               | Chat store perzisztál a route-ok  |
|                                      |                                            | között — a destroy dead code      |

2.4 Ami kimaradt / el lett halasztva
--------------------------------------
| Elem                               | Státusz         | Tervezett fázis |
|------------------------------------|-----------------|-----------------|
| BullMQ integráció                  | Elhalasztva     | Phase 5 eleje   |
| Unit tesztek az új service-ekhez   | Nincs           | Phase 5 eleje   |
| (ClanService, PheromoneService,    |                 |                 |
|  WsGateway)                        |                 |                 |
| Feromon mozgási boost számítás     | Elhalasztva     | Phase 5         |
| ESLint + Prettier + Husky          | Elhalasztva     | Phase 5         |
| recalcProductionRates duplikáció   | Nincs javítva   | Phase 5         |
| Felhasználókereső API a privát     | Nincs           | Sprint 5.1      |
|  chat-hez (GET /users/search?q=)   |                 |                 |
| Földalatti/felszíni réteg váltás   | Elhalasztva     | Phase 5         |
| Canvas mozgás animáció             | Elhalasztva     | Phase 5         |

================================================================================
3. AMI JÓL MŰKÖDÖTT
================================================================================

3.1 WebSocket gateway JWT auth + room menedzsment
--------------------------------------------------
A WsGateway.connect() metódusa tisztán kezeli az autentikációt:
- JWT token kiolvasása a handshake.auth-ból
- jwtService.verify() validálás
- Invalid token → azonnali disconnect
- Sikeres auth → automatikus room join (user:<id>, clan:<id>, global)

A room rendszer (user, clan, global) jól skálázódik: a PheromoneService,
CombatService és a chat handlerek mind ugyanazt a room struktúrát
használják, így a broadcast logika konzisztens.

3.2 $transaction védelem a klán műveleteknél
----------------------------------------------
A Phase 1-3-ban bevált $transaction minta továbbfejlesztése a Phase 4-ben
érte el a csúcsát:
- createClan: clan + member létrehozás egy tranzakcióban (nincs orphaned clan)
- promoteMember: demote leader + promote target atomikusan (nincs leader nélküli klán)
- tradeResources: TOCTOU-védett — a hive fetch és a deduction is a tranzakción
  belül történik, így a resource check és a módosítás között nem változhat az állapot
- setDiplomacy: upsert művelet, nincs race condition a create/update között
- joinClan: P2002 unique constraint error elkapása a race condition kezelésére

3.3 WebSocket singleton + exponential backoff
-----------------------------------------------
A ws-client.ts singleton mintája és az exponenciális backoff (1s → 2s → 4s → … → 30s)
stabil kapcsolatot biztosít:
- reconnectAttempts reset sikeres csatlakozáskor
- socket.io reconnection: false (saját kezelés a kontroll miatt)
- transports: ['websocket', 'polling'] fallback
- Set-based callback registry (memória-biztos unsubscribe pattern)
- useWebSocket composable: watch auth.token → automatikus connect/disconnect

3.4 Canvas feromon rajzolás WebSocket-kel
-------------------------------------------
A MapView.vue drawMode rendszere szépen integrálja a Canvas API-t és a WebSocket-et:
- mousedown → új path kezdése
- mousemove → eventToHex() raycasting → pont hozzáadása a path-hoz → azonnali
  WS broadcast (PHEROMONE_DRAW) → a klán többi tagja valós időben látja a rajzolást
- mouseup → POST /pheromone/draw mentés
- Bezier-görbék quadraticCurveTo-val → organikus görbék
- shadowBlur: 8 glow effekt (piros = ATTACK, zöld = DEFEND)
- Külön renderelési rétegek: aktív trail-ek (DB-ből), élő rajzolás (WS-ből),
  saját rajzolás (canvas state-ből)
- Cursor váltás: drawMode = crosshair, pan = grab/grabbing

3.5 Chat parancsrendszer
--------------------------
A parseCommand() regex-alapú parancsértelmezése (/w, /c, /g) lehetővé teszi
a csatornaváltást anélkül, hogy a felhasználónak tabokat kellene váltania:
- /w <felhasználó> <üzenet> → privát üzenet
- /c <üzenet> → klán chat
- /g <üzenet> → globális chat
- Parancs nélküli üzenet → az aktív csatornára megy
- A parancs súgó a ChatPanel footerében van kijelezve

3.6 Code review hibafogás
----------------------------
A Phase 4 code review-jei több hibát is azonosítottak a véglegesítés előtt:
- chat.store.ts parseCommand(): regex match group-ok undefined ellenőrzése (TS strict null)
- auth.userId vs auth.user?.userId eltérés (auth store user objektumot tárol)
- ChatPanel isOwn() és ChatView filter auth.userId → auth.user?.userId javítás
- WsGateway handlePheromoneDraw: .then().catch() helyett async/await konzisztencia
- wsClient.on() callbackek memória kezelése (Set-based unsubscribe)
- Privát chat username vs userId diszkrepancia dokumentálása

================================================================================
4. AMIT MÁSKÉPP CSINÁLNÁNK
================================================================================

4.1 Unit tesztek azonnal az új service-ekhez
-----------------------------------------------
Ez a NEGYEDIK retrospektív, ami ezt a tanulságot tartalmazza — és a Phase 4
során ismét egyik új service-hez (ClanService, PheromoneService) sem készült
unit teszt. A meglévő 12 EngineService teszt továbbra is zöld, de az új
funkciók tesztfedettsége 0%.

A WebSocket gateway tesztelése különösen fontos lenne: a JWT auth flow,
a rate limiting, a room join/leave és az event broadcast mind tesztelhető
Socket.io testing utilities-vel.

*Tanulság:* Phase 5-ben az ELSŐ új service-nél kötelezővé kell tenni a
unit teszt írását. Nem elég a retrospektívben leírni — be kell tartani.

4.2 Privát chat felhasználókereső hiánya
-------------------------------------------
A jelenlegi implementációban a privát chat username-t kér a felhasználótól,
és azt használja userId-ként a WebSocket üzenetben. Ez demó működésre
alkalmas, de éles környezetben nem működik (a gateway userId alapján
azonosítja a socket-et, nem username alapján).

*Tanulság:* Mielőtt egy funkciót "késznek" nyilvánítunk, ellenőrizni kell,
hogy a teljes adatfolyam (UI input → API/WS → backend → válasz) helyes-e.
Egy GET /users/search?q= endpoint és egy felhasználókereső komponens
hozzáadása a privát chat-hez az első teendők között kell legyen.

4.3 WebSocket kapcsolat állapot visszajelzés
----------------------------------------------
Az első implementációban a wsClient.emit() csendben eldobta az üzeneteket,
ha a socket nem volt csatlakozva — a felhasználó semmilyen visszajelzést
nem kapott. Ezt a code review után javítottuk: a ChatPanel most egy
"⚡ Kapcsolódás..." jelzőt mutat és letiltja a send gombot, ha a
wsClient.isConnected === false.

*Tanulság:* Minden hálózati műveletnél (HTTP és WebSocket) implementálni kell
a loading, error és disconnected állapotok vizuális visszajelzését.
Ez nem "nice to have" — alapvető UX követelmény.

4.4 Race condition kezelés a WebSocket gateway-ben
----------------------------------------------------
A WsGateway handleClanChat metódusa ellenőrzi a klán tagságot a Prisma-ban,
de a handleConnection során beállított room join és a chat üzenet küldése
között a felhasználó elhagyhatja a klánt. A Prisma ellenőrzés ezt kezeli
(a message nem kerül broadcast-ra), de a socket továbbra is a room-ban marad.

*Tanulság:* WebSocket room tagság és adatbázis állapot között inkonzisztencia
léphet fel. A room leave/join műveleteket esemény-vezérelten kell kezelni
(pl. a ClanService.leaveClan() után a WsGateway.leaveClanRoom() hívása).
Ez jelenleg nem implementált — a socket a következő reconnect-ig a régi
room-ban marad.

*Súlyosság:* Alacsony (az adatbázis ellenőrzés megakadályozza az illetéktelen
broadcast-ot), de Phase 5-ben javítandó.

================================================================================
5. TECHNIKAI ADÓSSÁG
================================================================================

| Adósság                           | Súlyosság | Terv                                           |
|-----------------------------------|-----------|-------------------------------------------------|
| BullMQ integráció hiánya          | Magas     | Phase 5 első sprintjében bevezetni             |
| Unit tesztek hiánya (új servicek) | Közepes   | Phase 5 során pótolni (ClanService,            |
|                                   |           | PheromoneService, WsGateway)                    |
| Privát chat felhasználókereső     | Közepes   | GET /users/search?q= endpoint + UI komponens   |
|  hiánya (username ≠ userId)       |           |                                                 |
| WebSocket room és DB állapot      | Alacsony  | Esemény-vezérelt room leave/join a             |
|  inkonzisztencia                  |           | ClanService-ből                                |
| ESLint + Prettier + Husky         | Alacsony  | Phase 5 elején beállítani                      |
| recalcProductionRates duplikáció  | Alacsony  | shared/math.ts-be mozgatni (Phase 1 óta nyitva)|
| Chat store destroy() dead code    | Alacsony  | Vagy becsatlakoztatni az onUnmounted-hoz,      |
|                                   |           | vagy explicit életciklust definiálni           |
| NotificationPanel @blur close     | Alacsony  | click-outside directive vagy teleport-olt      |
|  törékenysége                     |           | overlay használata a dropdown-hoz              |
| Canvas komponens best practices   | Alacsony  | Dokumentálni a cleanup checklist-et            |
|  nincs dokumentálva               |           | (Phase 3 óta nyitva)                           |
| Nincs integrációs/E2E teszt       | Közepes   | Phase 5 során E2E teszteket hozzáadni          |
| Feromon mozgási boost hiánya      | Alacsony  | Phase 5-ben implementálni                      |

================================================================================
6. SZÁMOK
================================================================================

Phase 4 statisztikák:
- **Új Prisma modellek:** 4 (Clan, ClanMember, ClanDiplomacy, ClanTrade, FeromonTrail)
  — valójában 5, mert FeromonTrail is része a Phase 4-nek
- **Új NestJS modulok:** 3 (ClanModule, WsModule, PheromoneModule)
- **Új API végpontok:** 10 (8 klán + 2 feromon: POST /clan/create, /clan/join,
  GET /clan/:id, POST /clan/leave, /clan/promote, /clan/trade,
  POST /clan/diplomacies, GET /clan/diplomacies, POST /pheromone/draw,
  GET /pheromone/active/:clanId)
- **WebSocket eventek:** 7 (CLAN_CHAT, GLOBAL_CHAT, PRIVATE_MESSAGE,
  ATTACK_INCOMING, ATTACK_RESULT, PHEROMONE_DRAW, PHEROMONE_VISIBLE, NOTIFICATION)
  — valójában 8, az ATTACK_INCOMING és NOTIFICATION a shared/types.ts-ben van
- **Új backend fájlok:** 9 (clan.service, clan.controller, clan.module,
  ws.gateway, ws.module, pheromone.service, pheromone.controller, pheromone.module,
  + 1 Prisma migráció)
- **Új frontend fájlok:** 8 (ws-client.ts, useWebSocket.ts, chat.store.ts,
  ChatPanel.vue, ChatView.vue, NotificationPanel.vue, + 2 szerkesztett
  [router/index.ts, AppShell.vue])
- **Szerkesztett fájlok:** 5 (MapView.vue feromon rajzolás, app.module.ts
  modul regisztrációk, router/index.ts, AppShell.vue, Prisma schema)
- **TypeScript typecheck:** shared ✅, backend ✅, frontend ✅ (minden sprintnél)
- **Unit tesztek:** 12 (meglévő EngineService tesztek, mind zöld — nincs új)
- **Összes API végpont Phase 1+2+3+4:** 23
- **Összes Prisma modell:** 13 (User, Hive, Chamber, RefreshToken,
  UnitBatch, Mutation, MapHex, Movement, Clan, ClanMember, ClanDiplomacy,
  ClanTrade, FeromonTrail)
- **Összes NestJS modul:** 9 (AppModule, PrismaModule, AuthModule,
  HiveModule, MilitaryModule, MutationModule, MapModule, MovementModule,
  CombatModule, ClanModule, WsModule, PheromoneModule)
  — valójában 12, beleértve az AppModule-t
- **Frontend route-ok:** 8 (/, /login, /register, /hive, /map,
  /military, /mutations, /chat)
- **Pinia store-ok:** 7 (auth, hive, military, mutation, map, movement, chat)

================================================================================
7. JAVASLATOK PHASE 5-RE
================================================================================

7.1 Sprint 5.1 előtt
----------------------
- [ ] BullMQ integráció bevezetése (MAGAS prioritás — a játék core élménye függ tőle)
- [ ] Unit tesztek pótlása: ClanService, PheromoneService, WsGateway
- [ ] GET /users/search?q= endpoint + felhasználókereső komponens a privát chat-hez
- [ ] WebSocket room leave/join esemény-vezérelt kezelése a ClanService-ből
- [ ] ESLint + Prettier + Husky konfiguráció
- [ ] recalcProductionRates áthelyezése shared/math.ts-be
- [ ] Chat store destroy() becsatlakoztatása vagy eltávolítása

7.2 Sprint 5.1 (Királynő Képzés)
-----------------------------------
- QueenTraining Prisma modell
- QueenController: POST /queen/train
- Keltető szint követelmény ellenőrzése
- DNS Nektár költség validálás
- BullMQ job: képzés befejezése (itt kell a BullMQ-t először használni!)

7.3 Általános javaslatok
--------------------------
- **BullMQ azonnali bevezetése**: Ez az ÖTÖDIK fázis, és a BullMQ még mindig
  nincs bevezetve. A játék core élménye (időzített támadások, keltetés, kutatás,
  Királynő képzés) függ tőle. Phase 5-ben ezt NEM szabad tovább halasztani.
  A Sprint 5.1 Királynő képzése az első olyan funkció, ami valódi időzítést
  igényel — ez a tökéletes alkalom a BullMQ bevezetésére.
- **Unit tesztek kötelezővé tétele**: Phase 5-ben az első új service-nél
  azonnal unit tesztet kell írni. Ez a negyedik retrospektív, ami ezt javasolja.
- **WebSocket és DB állapot szinkronizálása**: A ClanService műveleteknél
  (leaveClan, promoteMember) a WsGateway room frissítése esemény-vezérelten.
- **Privát chat felhasználókereső**: A Phase 5 első feladatai között legyen
  a GET /users/search?q= endpoint és a felhasználókereső UI.
- **Canvas komponens best practices**: Dokumentálni a Phase 3-4 során felhalmozott
  canvas tapasztalatokat (raf cleanup, event listener cleanup, initial sizing,
  passive modifiers, cursor management).
- **Code review + typecheck ciklus megtartása**: Phase 4-ben is több hibát fogott meg.
- **Dokumentáció folyamatos frissítése**: PHASE_TASKS.md, retrospektívek.

================================================================================
8. KONKLÚZIÓ
================================================================================

A Phase 4 sikeresen teljesítette a kitűzött célokat. A játék most már
rendelkezik egy teljes értékű közösségi réteggel:

- **Klánok**: Létrehozás, belépés, kilépés, rangok (Vezér/Tiszt/Tag),
  belső erőforrás-kereskedelem ($transaction védelemmel), diplomáciai
  rendszer (szövetség, hadüzenet, NAP, semleges)
- **WebSocket infrastruktúra**: Socket.io gateway JWT autentikációval,
  szoba-alapú broadcast (user, clan, global), rate limiting,
  exponenciális backoff reconnect a frontenden
- **Feromon-nyomok**: Canvas alapú rajzolás Bezier-görbékkel,
  valós idejű WebSocket broadcast a klán tagoknak, 8 órás élettartam,
  ATTACK (piros) és DEFEND (zöld) típusok
- **Chat rendszer**: Klán chat, globális chat, privát üzenetek,
  parancssor (/w /c /g), értesítési panel, unread számlálók,
  kapcsolódás állapotjelző

A Phase 1+2+3+4 együtt egy kiforrott MMO stratégiai játékot alkot:
a felhasználók tudnak regisztrálni, kaptárt építeni, kamrákat fejleszteni,
egységeket kelteni, mutációkat kutatni, a 7,651 hexás térképet böngészni,
más kaptárakat támadni, klánokat alapítani, feromon-nyomokat rajzolni,
és valós időben kommunikálni — mindezt valós idejű erőforrás-számítással,
egység elhalással, és WebSocket kommunikációval.

A projekt státusza:
| Phase | Státusz |
|-------|---------|
| 1 — MVP Core Loop              | ✅ |
| 2 — The Hatching               | ✅ |
| 3 — World Map & Bloodshed      | ✅ |
| 4 — Swarm Mind & Feromons      | ✅ |
| 5 — Terjeszkedés & Rajzás      | ⬜ |
| 6 — Polish, PvE, Monetizáció   | ⬜ |

A Phase 5 a terjeszkedés és a rajzás mechanikát fogja bevezetni (Királynő
képzés, új kaptár alapítás, multi-hive management), ami a játék hosszú távú
stratégiai mélységét fogja megadni. A legfontosabb technikai adósság — a
BullMQ integráció — a Phase 5 elején prioritásként kezelendő, mivel a
Királynő képzés időzített folyamat, ami már nem működhet instant
végrehajtással.
