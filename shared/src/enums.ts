// ============================================================
// A RAJ - Shared Enums
// ============================================================

/** Kamra (épület) típusok a kaptárban */
export enum ChamberType {
  QUEEN = 'QUEEN',
  HATCHERY = 'HATCHERY',
  DIGESTIVE_PIT = 'DIGESTIVE_PIT',
  ACID_GLAND = 'ACID_GLAND',
  MUSHROOM_GARDEN = 'MUSHROOM_GARDEN',
  ROOT_SIPHON = 'ROOT_SIPHON',
  HEAT_CHAMBER = 'HEAT_CHAMBER',
  PHEROMONE_GLAND = 'PHEROMONE_GLAND',
}

/** Egység típusok */
export enum UnitType {
  WORKER = 'WORKER',
  BLOOD_TANK = 'BLOOD_TANK',
  ACID_SPITTER = 'ACID_SPITTER',
  SCOUT_WASP = 'SCOUT_WASP',
  QUEEN = 'QUEEN',
}

/** Sebzés típusok */
export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  ACID = 'ACID',
}

/** Feromon típusok */
export enum PheromoneType {
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
}

/** Hexa mező típusok a térképen */
export enum HexType {
  EMPTY = 'EMPTY',
  MOUNTAIN = 'MOUNTAIN',
  LAKE = 'LAKE',
  HIVE = 'HIVE',
  PVE_NEST = 'PVE_NEST',
}

/** Támadás típusok */
export enum AttackType {
  RAID = 'RAID',
  SIEGE = 'SIEGE',
}

/** Klán rangok */
export enum ClanRole {
  LEADER = 'LEADER',
  OFFICER = 'OFFICER',
  MEMBER = 'MEMBER',
}

/** Diplomáciai státuszok */
export enum DiplomacyStatus {
  ALLY = 'ALLY',
  ENEMY = 'ENEMY',
  NAP = 'NAP',
  NEUTRAL = 'NEUTRAL',
}

/** Mutációk típusai */
export enum MutationType {
  ARMOR = 'ARMOR',
  ACID_SPIT = 'ACID_SPIT',
  METABOLISM = 'METABOLISM',
  MUSHROOM_VENOM = 'MUSHROOM_VENOM',
  DEEP_ROOT = 'DEEP_ROOT',
}

/** Prémium fiók szintek */
export enum PremiumTier {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}
