// ============================================================
// A RAJ - Shared Constants
// ============================================================

import { UnitType, ChamberType, MutationType, PveNestTier, CosmeticSkinType } from './enums.js';
import type { UnitStats, MutationTreeNode, ChamberDefinition } from './types.js';

// --- Unit Statistics ---

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  [UnitType.WORKER]: {
    type: UnitType.WORKER,
    attackPhysical: 5,
    attackAcid: 0,
    defensePhysical: 10,
    defenseAcid: 5,
    speed: 4,
    carryingCapacity: 100,
    lifespanHours: 96,
    hatchTimeMinutes: 30,
    biomassCost: 50,
    waterCost: 20,
    heatCost: 10,
  },
  [UnitType.BLOOD_TANK]: {
    type: UnitType.BLOOD_TANK,
    attackPhysical: 20,
    attackAcid: 0,
    defensePhysical: 80,
    defenseAcid: 20,
    speed: 2,
    carryingCapacity: 30,
    lifespanHours: 120,
    hatchTimeMinutes: 120,
    biomassCost: 150,
    waterCost: 60,
    heatCost: 40,
  },
  [UnitType.ACID_SPITTER]: {
    type: UnitType.ACID_SPITTER,
    attackPhysical: 10,
    attackAcid: 70,
    defensePhysical: 20,
    defenseAcid: 40,
    speed: 3,
    carryingCapacity: 40,
    lifespanHours: 72,
    hatchTimeMinutes: 90,
    biomassCost: 200,
    waterCost: 80,
    heatCost: 60,
  },
  [UnitType.SCOUT_WASP]: {
    type: UnitType.SCOUT_WASP,
    attackPhysical: 8,
    attackAcid: 5,
    defensePhysical: 15,
    defenseAcid: 10,
    speed: 8,
    carryingCapacity: 10,
    lifespanHours: 48,
    hatchTimeMinutes: 45,
    biomassCost: 100,
    waterCost: 40,
    heatCost: 30,
  },
  [UnitType.QUEEN]: {
    type: UnitType.QUEEN,
    attackPhysical: 30,
    attackAcid: 30,
    defensePhysical: 50,
    defenseAcid: 50,
    speed: 1,
    carryingCapacity: 0,
    lifespanHours: 0, // Immortal until settled or killed
    hatchTimeMinutes: 480, // 8 hours for a new Queen
    biomassCost: 5000,
    waterCost: 2000,
    heatCost: 1000,
  },
};

// --- Building Definitions ---

export const CHAMBER_DEFINITIONS: Record<ChamberType, ChamberDefinition> = {
  [ChamberType.QUEEN]: {
    name: 'Királynő Terme',
    maxLevel: 20,
    baseBiomassCost: 500,
    baseWaterCost: 300,
    buildTimeMinutes: 60,
    description: 'A kaptár szíve – ha lerombolják, elveszted a bázist',
  },
  [ChamberType.HATCHERY]: {
    name: 'Keltető',
    maxLevel: 10,
    baseBiomassCost: 300,
    baseWaterCost: 200,
    buildTimeMinutes: 30,
    hatcherySpeedPerLevel: 0.9, // Multiplier: each level reduces hatch time by 10%
    description: 'Sereg képzése. Magasabb szint -> gyorsabb keltetés',
  },
  [ChamberType.DIGESTIVE_PIT]: {
    name: 'Emésztő Verem',
    maxLevel: 10,
    baseBiomassCost: 200,
    baseWaterCost: 150,
    buildTimeMinutes: 20,
    storagePerLevel: 1000,
    description: 'Raktár – biomassza és víz tárolása',
  },
  [ChamberType.ACID_GLAND]: {
    name: 'Sav-Mirigy',
    maxLevel: 10,
    baseBiomassCost: 400,
    baseWaterCost: 100,
    buildTimeMinutes: 45,
    defensePerLevel: 50,
    description: 'Passzív védelem (fal megfelelője)',
  },
  [ChamberType.MUSHROOM_GARDEN]: {
    name: 'Gombakert',
    maxLevel: 10,
    baseBiomassCost: 150,
    baseWaterCost: 250,
    buildTimeMinutes: 15,
    biomassPerHourPerLevel: 20,
    description: 'Biomassza termelés',
  },
  [ChamberType.ROOT_SIPHON]: {
    name: 'Gyökér-Szívó',
    maxLevel: 10,
    baseBiomassCost: 150,
    baseWaterCost: 100,
    buildTimeMinutes: 15,
    waterPerHourPerLevel: 20,
    description: 'Víz termelés',
  },
  [ChamberType.HEAT_CHAMBER]: {
    name: 'Hőkamra',
    maxLevel: 10,
    baseBiomassCost: 150,
    baseWaterCost: 100,
    buildTimeMinutes: 15,
    heatPerHourPerLevel: 30,
    description: 'Hő termelés',
  },
  [ChamberType.PHEROMONE_GLAND]: {
    name: 'Feromon-Mirigy',
    maxLevel: 5,
    baseBiomassCost: 500,
    baseWaterCost: 400,
    buildTimeMinutes: 60,
    pheromonesPerLevel: 2,
    description: 'Feromon-nyomok generálása (klán szinten)',
  },
};

// --- Building Cost Scaling ---

/** Cost multiplier per level: cost = baseCost * (level ^ COST_SCALE) */
export const COST_SCALE = 1.5;

/** Build time multiplier per level: time = baseTime * (level ^ TIME_SCALE) */
export const TIME_SCALE = 1.3;

// --- Attrition ---

/** Percentage of unit cost returned to biomass on natural death */
export const ATTRITION_BIOMASS_RETURN = 0.1;

// --- Combat ---

/** Percentage of carrying capacity used for loot on raid */
export const RAID_LOOT_CAPACITY_FACTOR = 0.5;

// --- Pheromone ---

/** Speed bonus for friendly attack pheromone trails */
export const PHEROMONE_ATTACK_SPEED_BONUS = 0.15;

/** Heat/water consumption reduction for friendly defend pheromone trails */
export const PHEROMONE_DEFEND_CONSUMPTION_REDUCTION = 0.2;

/** Pheromone trail duration in hours */
export const PHEROMONE_TRAIL_DURATION_HOURS = 8;

// --- Map ---

/** Starting map radius (how many hexes in each direction) */
export const MAP_STARTING_RADIUS = 50;

/** Hex size in pixels for canvas rendering */
export const HEX_SIZE_PX = 40;

// --- Mutation Tree ---

export const MUTATION_TREE: MutationTreeNode[] = [
  {
    type: MutationType.ARMOR,
    name: 'Páncélzat',
    description: '+Védő élettartam, +páncél',
    maxLevel: 5,
    prerequisites: [],
    synergies: [
      {
        required: [{ type: MutationType.ARMOR, level: 3 }, { type: MutationType.ACID_SPIT, level: 2 }],
        unlocksUnit: UnitType.BLOOD_TANK,
        bonusDescription: 'Feloldja a Vér-Páncélos egységet',
      },
    ],
  },
  {
    type: MutationType.ACID_SPIT,
    name: 'Sav Köpés',
    description: '+Ostromló sebzés',
    maxLevel: 5,
    prerequisites: [],
    synergies: [
      {
        required: [{ type: MutationType.ACID_SPIT, level: 2 }, { type: MutationType.ARMOR, level: 3 }],
        unlocksUnit: UnitType.ACID_SPITTER,
        bonusDescription: 'Feloldja a Sav-Köpő egységet',
      },
    ],
  },
  {
    type: MutationType.METABOLISM,
    name: 'Anyacsere',
    description: '+Hő termelés, gyorsabb keltetés',
    maxLevel: 5,
    prerequisites: [],
    synergies: [],
  },
  {
    type: MutationType.MUSHROOM_VENOM,
    name: 'Gombaméreg',
    description: '+Gombakert hozam',
    maxLevel: 5,
    prerequisites: [],
    synergies: [],
  },
  {
    type: MutationType.DEEP_ROOT,
    name: 'Mély Gyökér',
    description: '+Víz termelés',
    maxLevel: 5,
    prerequisites: [],
    synergies: [],
  },
];

// --- Mutation Cost Scaling ---

/** DNA Nectar cost per mutation level */
export const MUTATION_DNA_NECTAR_COST_PER_LEVEL = 100;

/** Mutation research time in minutes per level */
export const MUTATION_RESEARCH_TIME_MINUTES_PER_LEVEL = 60;

// --- Queen Training ---

/** DNA Nectar cost to train a new Queen */
export const QUEEN_DNA_NECTAR_COST = 500;

/** Minimum Hatchery level required to train a Queen */
export const QUEEN_MIN_HATCHERY_LEVEL = 5;

// --- Limits ---

/** Maximum chambers per hive */
export const MAX_CHAMBERS = 50;

/** Starting resources for a new hive */
export const STARTING_RESOURCES = {
  biomass: 500,
  water: 300,
  heat: 100,
  dnaNectar: 0,
};

// --- Cosmetic Skins ---

/** Skin color hex codes for map rendering */
export const SKIN_COLORS: Record<CosmeticSkinType, string | null> = {
  [CosmeticSkinType.DEFAULT]: null, // default red (#cc3333)
  [CosmeticSkinType.CRIMSON]: '#ff2244',
  [CosmeticSkinType.OBSIDIAN]: '#1a1a2e',
  [CosmeticSkinType.VENOM_GREEN]: '#22cc44',
  [CosmeticSkinType.HIVE_GOLD]: '#ffaa00',
  [CosmeticSkinType.SPECTRAL]: '#8866ff',
};

/** Cosmetic skin costs in Zselé */
export const COSMETIC_COSTS: Record<CosmeticSkinType, number> = {
  [CosmeticSkinType.DEFAULT]: 0,
  [CosmeticSkinType.CRIMSON]: 200,
  [CosmeticSkinType.OBSIDIAN]: 300,
  [CosmeticSkinType.VENOM_GREEN]: 200,
  [CosmeticSkinType.HIVE_GOLD]: 500,
  [CosmeticSkinType.SPECTRAL]: 800,
};

/** Premium hatch boost multiplier (10% faster, never instant) */
export const PREMIUM_HATCH_BOOST = 0.9;

/** Monthly premium cost in Zselé */
export const PREMIUM_MONTHLY_COST = 500;

// --- PvE Nest Tiers ---

export interface PveNestTierConfig {
  attackPhysical: number;
  attackAcid: number;
  defensePhysical: number;
  defenseAcid: number;
  lootBiomass: number;
  lootWater: number;
  lootDnaNectar: number;
  respawnHours: number;
}

export const PVE_NEST_TIERS: Record<PveNestTier, PveNestTierConfig> = {
  [PveNestTier.EASY]: {
    attackPhysical: 30,
    attackAcid: 10,
    defensePhysical: 25,
    defenseAcid: 10,
    lootBiomass: 150,
    lootWater: 80,
    lootDnaNectar: 5,
    respawnHours: 2,
  },
  [PveNestTier.MEDIUM]: {
    attackPhysical: 60,
    attackAcid: 25,
    defensePhysical: 50,
    defenseAcid: 20,
    lootBiomass: 400,
    lootWater: 200,
    lootDnaNectar: 15,
    respawnHours: 6,
  },
  [PveNestTier.HARD]: {
    attackPhysical: 100,
    attackAcid: 50,
    defensePhysical: 80,
    defenseAcid: 35,
    lootBiomass: 1000,
    lootWater: 500,
    lootDnaNectar: 40,
    respawnHours: 24,
  },
};
