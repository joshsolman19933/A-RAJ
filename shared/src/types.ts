// ============================================================
// A RAJ - Shared Types
// ============================================================

import {
  ChamberType,
  UnitType,
  PheromoneType,
  HexType,
  AttackType,
  ClanRole,
  MutationType,
  PremiumTier,
} from './enums.js';

// --- Coordinates ---

export interface HexCoord {
  q: number;
  r: number;
}

// --- Resources ---

export interface Resources {
  biomass: number;
  water: number;
  heat: number;
  dnaNectar: number;
}

export interface ProductionRates {
  biomassPerHour: number;
  waterPerHour: number;
  heatPerHour: number;
  heatConsumptionPerHour: number;
}

// --- Chamber ---

export interface ChamberData {
  id: string;
  type: ChamberType;
  level: number;
}

export interface ChamberDefinition {
  name: string;
  maxLevel: number;
  baseBiomassCost: number;
  baseWaterCost: number;
  buildTimeMinutes: number;
  description: string;
  biomassPerHourPerLevel?: number;
  waterPerHourPerLevel?: number;
  heatPerHourPerLevel?: number;
  hatcherySpeedPerLevel?: number;
  storagePerLevel?: number;
  defensePerLevel?: number;
  pheromonesPerLevel?: number;
}

// --- Unit ---

export interface UnitBatchData {
  id: string;
  unitType: UnitType;
  count: number;
  hatchedAt: string;
}

export interface UnitStats {
  type: UnitType;
  attackPhysical: number;
  attackAcid: number;
  defensePhysical: number;
  defenseAcid: number;
  speed: number; // hex fields per hour
  carryingCapacity: number;
  lifespanHours: number;
  hatchTimeMinutes: number;
  biomassCost: number;
  waterCost: number;
  heatCost: number;
}

// --- Hive ---

export interface HiveData {
  id: string;
  q: number;
  r: number;
  resources: Resources;
  productionRates: ProductionRates;
  chambers: ChamberData[];
  unitBatches: UnitBatchData[];
  mutations: MutationData[];
  lastUpdated: string;
}

// --- Mutation ---

export interface MutationData {
  id: string;
  mutationType: MutationType;
  level: number;
}

export interface MutationTreeNode {
  type: MutationType;
  name: string;
  description: string;
  maxLevel: number;
  prerequisites: MutationPrerequisite[];
  synergies: MutationSynergy[];
}

export interface MutationPrerequisite {
  type: MutationType;
  level: number;
}

export interface MutationSynergy {
  required: MutationPrerequisite[];
  unlocksUnit?: UnitType;
  bonusDescription: string;
}

// --- Map ---

export interface MapHexData {
  q: number;
  r: number;
  type: HexType;
  hiveId?: string;
  hiveName?: string;
  clanColorHex?: string;
}

export interface MapViewport {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}

// --- Movement & Combat ---

export interface MovementData {
  id: string;
  attackType: AttackType;
  fromHiveId: string;
  targetQ: number;
  targetR: number;
  units: UnitBatchBrief[];
  sentAt: string;
  arriveAt: string;
}

export interface UnitBatchBrief {
  unitType: UnitType;
  count: number;
}

export interface CombatReport {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerLosses: UnitBatchBrief[];
  defenderLosses: UnitBatchBrief[];
  resourcesLooted?: Partial<Resources>;
  chambersDestroyed?: ChamberType[];
  resolvedAt: string;
  isVictory: boolean; // from attacker's perspective
}

// --- Clan ---

export interface ClanData {
  id: string;
  name: string;
  colorHex: string;
  description: string;
  memberCount: number;
  leaderId: string;
}

export interface ClanMemberData {
  userId: string;
  username: string;
  role: ClanRole;
  joinedAt: string;
}

// --- Pheromone ---

export interface PheromoneTrailData {
  id: string;
  clanId: string;
  type: PheromoneType;
  path: HexCoord[];
  expiresAt: string;
  createdBy: string;
}

// --- Auth ---

export interface AuthPayload {
  userId: string;
  username: string;
  premiumTier: PremiumTier;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthPayload;
}

// --- WebSocket Events ---

export enum WsEvent {
  ATTACK_INCOMING = 'attack:incoming',
  ATTACK_RESULT = 'attack:result',
  PHEROMONE_DRAW = 'pheromone:draw',
  PHEROMONE_VISIBLE = 'pheromone:visible',
  CLAN_CHAT = 'clan:chat',
  PRIVATE_MESSAGE = 'private:message',
  GLOBAL_CHAT = 'global:chat',
  NOTIFICATION = 'notification',
}

export interface WsAttackIncoming {
  attackerName: string;
  attackerClan?: string;
  units: UnitBatchBrief[];
  arriveAt: string;
  targetHiveId: string;
}

export interface WsChatMessage {
  id: string;
  fromUserId: string;
  fromUsername: string;
  message: string;
  sentAt: string;
}
