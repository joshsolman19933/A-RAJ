================================================================================
                    GAME DESIGN DOCUMENT: A RAJ (Munkanév)
================================================================================

Műfaj:         Böngészős MMO Stratégia (Base-builder)
Célplatform:   PC Böngésző + Mobil (PWA)
Vizuális stílus: Biológiai Sci-Fi – organikus, sötét, "húsos" UI,
                 Zerg/Tyranida beütés

================================================================================
1. ÖSSZEGZÉS & ELEVATOR PITCH
================================================================================

Képzeld el a Traviant, de falvak helyett egy földalatti idegen kaptárt építesz
húsból és nyálkából. A legnagyobb különbség: a sereged nem él örökké.
A hagyományos stratégiákkal ellentétben (ahol hónapokig gyűjtesz egy
gigasereget), itt a rovarszerű katonáid pár nap alatt elhalnak.
A sikeres invázió titka a tökéletesen időzített "keltetési hullám" és a
térképre permetezett szövetségi feromon-nyomok kihasználása.

================================================================================
2. CORE GAME LOOP
================================================================================

Nyersanyag termelés
  -> Kaptár bővítése (Kamrák ásása)
    -> DNS Mutációk (Fejlődés)
      -> Keltetési hullám időzítése
        -> Támadás / Védekezés / Rablás
          -> Elhalás (Attrition)
            -> Új Királynő rajzása (Terjeszkedés)

================================================================================
3. NYERSANYAG RENDSZER
================================================================================

Nincs fa, nincs vas – minden organikus:

  Nyersanyag      | Szerep                                    | Termelés
  ----------------|-------------------------------------------|------------------
  Biomassza       | Fő építési anyag kamrákhoz, egységekhez   | Gombakertek
  Víz             | Fenntartó anyag, nagyobb kaptár = több    | Gyökér-szívók
  Hő              | Termelés/fogyasztás egyensúly –            | Hőkamrák termelik,
                  | nem halmozódik                            | Keltetők fogyasztják
  DNS Nektár      | Fejlesztésekhez, mutációkhoz (ritka)      | PvE lények, gubacsok

FONTOS: A Hő egy folyamatos termelés/fogyasztás mérleg. Ha túl sok Keltetőt
építesz és nincs elég Hőkamrád, leáll a termelés. Ez akadályozza meg a
korlátlan spam-építkezést.

================================================================================
4. BÁZISÉPÍTÉS – A KAPTÁR-RENDSZER
================================================================================

Épületek helyett Kamrákat ásol a föld alatt, hexagonális rácson.

  Kamra              | Funkció
  -------------------|---------------------------------------------------
  Királynő Terme     | A kaptár szíve – ha lerombolják, elveszted a bázist
  Keltető            | Sereg képzése. Magasabb szint -> gyorsabb keltetés
  Emésztő Verem      | Raktár – biomassza és víz tárolása
  Sav-Mirigy         | Passzív védelem (fal megfelelője)
  Gombakert          | Biomassza termelés
  Gyökér-Szívó       | Víz termelés
  Hőkamra            | Hő termelés
  Feromon-Mirigy     | Feromon-nyomok generálása (klán szinten)

================================================================================
5. EGYSÉG RENDSZER & ÉLETTARTAM (ATTRITION)
================================================================================

EZ A JÁTÉK LEGFONTOSABB INNOVÁCIÓJA!

Minden egységnek véges élettartama van: 72–120 óra (mutációtól függően).
Utána biomasszává bomlik vissza -> a bekerülési költség 10%-át visszakapod.

  Egység           | Típus      | Sebesség | Élettartam | Erősség
  -----------------|------------|----------|------------|-------------------
  Dolgozó (Herce)  | Gyűjtögető | Gyors    | 96 óra     | Sok teherbírás
  Vér-Páncélos     | Védő       | Lassú    | 120 óra    | Magas fiz. védelem
  Sav-Köpő         | Támadó     | Közepes  | 72 óra     | Pusztító támadás
  Fürkészdarázs    | Felderítő  | Nagyon gyors | 48 óra | Láthatatlan

TAKTIKAI MÉLYSÉG: Nem parkoltathatsz végtelen sereget! A támadást a
keltetési hullám csúcsára kell időzítened. Ha túl korán támadsz -> kevés
az egység. Ha túl későn -> elhalt a felük.

================================================================================
6. TECHNOLÓGIAI FA – MUTÁCIÓS HÁLÓ
================================================================================

Lineáris kutatások helyett szerteágazó Mutációs Háló. DNS Nektárt költve
te döntöd el a fókuszt:

                       ┌-- Páncélzat (+Védő élettartam, +páncél)
                       |
  DNS Nektár -- Királynő Mutációk --+-- Sav Köpés (+Ostromló sebzés)
                       |
                       +-- Anyacsere (+Hő termelés, gyorsabb keltetés)
                       |
                       +-- Gombaméreg (+Gombakert hozam)
                       |
                       +-- Mély Gyökér (+Víz termelés)

Minden ág 5 szint mély, az ágak között szinergiák vannak (pl. Páncélzat 3
+ Sav Köpés 2 = új hibrid egység nyílik meg).

================================================================================
7. VILÁGTÉRKÉP & MOZGÁS
================================================================================

- Hexagonális grid, két réteggel:
  - Felszín: Minden kaptár kijárata, hegyek, tavak, PvE fészkek
  - Földalatti Grádics: Csak közeli szomszédok látszanak

- Távolságszámítás: Pitagorasz-tétel hexa koordinátákon
- Egységenként eltérő sebesség (mező/óra)

================================================================================
8. HARCRENDSZER
================================================================================

Szimuláció alapú (mint Travianban), a szerver számolja azonnal.

  Támadás típusa    | Cél                  | Sereg igény
  ------------------|----------------------|-----------------------------
  Rablóhadjárat     | Nyersanyag lopás     | Herce + Fürkészdarázs (gyors)
  Ostrom            | Kamrák rombolása     | Sav-Köpő + Vér-Páncélos

Sebzés típusok:
- Tüskés sebzés (fizikai) vs. Savas sebzés (épületromboló)
- Vér-Páncélosok magas tüskés védelemmel, Sav-Köpők magas savas támadással

================================================================================
9. TERJESZKEDÉS – RAJZÁS
================================================================================

Nemes (Noble/Chief) helyett a terjeszkedés menete:

  1. Építs magas szintű Keltetőt
  2. Indítsd el az "Új Királynő" kiképzést
     (brutális Biomassza + DNS Nektár + idő)
  3. A Királynő készen -> kattints egy üres hexagonra a térképen
  4. "Rajzás indítása" -> Királynő + kísérő sereg elindul
  5. Megérkezés -> a kísérő sereg "beépül" az új kaptárba (elvesznek!)
  6. Új kaptár aktív, kezdődhet az építkezés

FIGYELEM: A rajzás alatt a kísérő sereg sebezhető – támadás esetén a
Királynő is elpusztulhat!

================================================================================
10. KLÁNRENDSZER – A BOLY (SWARM)
================================================================================

  Funkció              | Leírás
  ---------------------|------------------------------------------------
  Boly Név & Címer     | Egyedi vizuális azonosító a térképen
  Belső Feromon Piac   | DNS Nektár és nyersanyag csere a tagok között
  Vezérkar             | Tisztek, Feromon-nyomokat rajzolhatnak
  Közös Diplomácia     | Szövetség, hadüzenet, NAP (non-aggression pact)
  Boly Kaptár          | Közös "főhadiszállás", együtt fejlesztitek

================================================================================
11. FEROMON-NYOMOK (EGYEDI TÉRKÉP MECHANIKA)
================================================================================

A Boly Vezérei limitált számú Feromon-nyomot húzhatnak a világtérképre:

  Feromon típus       | Hatás
  --------------------|--------------------------------------------------
  Támadó (Vörös)      | Az útvonalon haladó boly-tagok +15% sebesség
  Védekező (Zöld)     | Az ide érkező erősítések kevesebb vizet/hőt
                        fogyasztanak

Ez a közösségi taktikai réteg – a klánvezetők ezzel koordinálják a
szinkronizált támadásokat. Vizuálisan: izzó, pulzáló csápok a térképen!

================================================================================
12. MONETIZÁCIÓ (F2P, ETIKUS)
================================================================================

NINCS Pay-to-Win! Sereg és nyersanyag nem vásárolható.

  Termék                 | Leírás
  -----------------------|-----------------------------------------------
  Prémium Fiók (havidíj) | +2 építési sor, sablon seregek, térkép-szűrők
  Kozmetikai Skinek      | Kaptárad más színben pulzál a térképen
  Keltetési Boost        | -10% keltetési idő (soha nem instant)
  Prémium Valuta: "Zselé"| A fentiek megvásárlására

================================================================================
13. UI / UX KONCEPCIÓ
================================================================================

- Mobil-first, kártyás elrendezés
- Sötét tónusú háttér pulzáló vénákkal, organikus navigációs menü
- Színkódok: vörös/zöld értesítések
- Bejövő támadás = villogó vörös képernyőszél
- Kamrák vizuálisan lüktetnek, Keltetőből "kikelés" animáció

================================================================================
14. TECHNOLÓGIAI ARCHITEKTÚRA
================================================================================

  Réteg         | Ajánlás                   | Indoklás
  --------------|---------------------------|---------------------------
  Adatbázis     | PostgreSQL                | ACID – semmi sem tűnhet el
  Backend       | Node.js (NestJS) / Golang | Gyors, skálázható
  Cache         | Redis                     | Session, ranglista, eventek
  Job Queue     | RabbitMQ / BullMQ         | Támadások pontos időzítése
  Frontend      | Vue.js 3 + Tailwind CSS   | Könnyű, gyors, Canvas térkép
  Valós idejű   | WebSocket (Socket.io)     | Támadások, chat, feromonok
  Hosting       | Docker + VPS              | Könnyű deploy, skálázható

KULCS OPTIMALIZÁCIÓ – LAZY CALCULATION:
NE cron jobbal frissíts másodpercenként minden fiókot! Ha a játékos belép,
a szerver megnézi mikor volt utoljára bent, és visszamenőleg kiszámolja
az eltelt idő nyersanyag-termelését és sereg-elhalását. Ez a Travian-szintű
skálázhatóság titka.