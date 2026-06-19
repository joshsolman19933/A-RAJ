// ============================================================
// A RAJ - Shared Math Utilities
// ============================================================

import type { HexCoord, ProductionRates, Resources } from './types.js';
import { UNIT_STATS, ATTRITION_BIOMASS_RETURN, HEX_SIZE_PX, CHAMBER_DEFINITIONS } from './constants.js';
import { UnitType, ChamberType } from './enums.js';

// --- Hex Grid Math ---

/**
 * Calculate the distance between two hex coordinates using axial system.
 * Formula: (abs(q1-q2) + abs(q1+r1-q2-r2) + abs(r1-r2)) / 2
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * Convert axial hex coordinates to pixel position (flat-top hexagons).
 * @param q - Axial Q coordinate
 * @param r - Axial R coordinate
 * @param size - Hex size in pixels
 */
export function axialToPixel(q: number, r: number, size: number = HEX_SIZE_PX): { x: number; y: number } {
  // For flat-top hexagons:
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

/**
 * Convert pixel coordinates to axial hex coordinates (flat-top).
 */
export function pixelToAxial(px: number, py: number, size: number = HEX_SIZE_PX): HexCoord {
  const q = (2 / 3 * px) / size;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / size;
  return hexRound({ q, r });
}

/**
 * Round fractional hex coordinates to nearest integer hex.
 */
export function hexRound(hex: HexCoord): HexCoord {
  const s = -hex.q - hex.r;
  let rq = Math.round(hex.q);
  let rr = Math.round(hex.r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - hex.q);
  const rDiff = Math.abs(rr - hex.r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/**
 * Get all hex coordinates within a given radius from center.
 */
export function hexesInRadius(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/**
 * Get the bounding box of hex coordinates for viewport queries.
 */
export function hexViewportBoundingBox(center: HexCoord, radius: number): { qMin: number; qMax: number; rMin: number; rMax: number } {
  // Conservative bounding box (square in axial space)
  return {
    qMin: center.q - radius,
    qMax: center.q + radius,
    rMin: center.r - radius,
    rMax: center.r + radius,
  };
}

// --- Resource Production ---

/**
 * Calculate resource production after a given time delta.
 */
export function calculateProducedResources(
  rates: ProductionRates,
  deltaHours: number,
  _storageCapacity: number,
): { biomass: number; water: number; heat: number } {
  const rawBiomass = rates.biomassPerHour * deltaHours;
  const rawWater = rates.waterPerHour * deltaHours;
  const netHeat = (rates.heatPerHour - rates.heatConsumptionPerHour) * deltaHours;

  return {
    biomass: Math.max(0, rawBiomass),
    water: Math.max(0, rawWater),
    heat: netHeat, // Heat can be negative
  };
}

/**
 * Calculate current resources after time delta, clamped to storage.
 * Heat is NOT stored — it's a rate balance.
 */
export function calculateCurrentResources(
  current: Resources,
  rates: ProductionRates,
  deltaHours: number,
  storageCapacity: number,
): Resources {
  const delta = calculateProducedResources(rates, deltaHours, storageCapacity);

  return {
    biomass: Math.min(storageCapacity, Math.max(0, current.biomass + delta.biomass)),
    water: Math.min(storageCapacity, Math.max(0, current.water + delta.water)),
    heat: Math.max(0, current.heat + delta.heat), // Heat floor is 0
    dnaNectar: current.dnaNectar, // DNA Nectar doesn't produce automatically
  };
}

// --- Attrition ---

/**
 * Check if a unit batch has expired based on hatchedAt and lifespan.
 * Returns the count of surviving units and biomass recovered.
 */
export function calculateAttrition(
  hatchedAt: Date,
  lifespanHours: number,
  count: number,
  unitCostBiomass: number,
  now: Date = new Date(),
): { survivingCount: number; biomassRecovered: number } {
  const ageHours = (now.getTime() - hatchedAt.getTime()) / (1000 * 60 * 60);

  if (ageHours >= lifespanHours) {
    // All units died
    return {
      survivingCount: 0,
      biomassRecovered: count * unitCostBiomass * ATTRITION_BIOMASS_RETURN,
    };
  }

  return {
    survivingCount: count,
    biomassRecovered: 0,
  };
}

// --- Travel Time ---

/**
 * Calculate travel time in hours for a mixed army from point A to point B.
 * Uses the SLOWEST unit speed (the army moves at the speed of its slowest member).
 */
export function calculateTravelTime(
  from: HexCoord,
  to: HexCoord,
  slowestUnitSpeed: number,
): number {
  const distance = hexDistance(from, to);
  if (slowestUnitSpeed <= 0) return Infinity;
  return distance / slowestUnitSpeed;
}

// --- Combat Math ---

/**
 * Calculate total attack/defense power from unit batches.
 */
export function sumUnitPower(
  batches: Array<{ unitType: UnitType; count: number }>,
  stat: 'attackPhysical' | 'attackAcid' | 'defensePhysical' | 'defenseAcid',
): number {
  return batches.reduce((total, batch) => {
    const stats = UNIT_STATS[batch.unitType];
    if (!stats) return total;
    return total + stats[stat] * batch.count;
  }, 0);
}

// --- Hatching ---

/**
 * Calculate the effective hatch time in minutes for a unit type,
 * reduced by the Hatchery chamber level.
 *
 * Each Hatchery level multiplies the time by hatcherySpeedPerLevel (0.9).
 * Level 3 Hatchery → multiplier 0.9^3 = 0.729.
 *
 * @param unitType - The unit type to calculate for
 * @param hatcheryLevel - The level of the Hatchery chamber (0 if none)
 * @returns Effective hatch time in minutes
 */
export function calculateHatchTime(
  unitType: UnitType,
  hatcheryLevel: number,
): number {
  const stats = UNIT_STATS[unitType];
  if (!stats) throw new Error(`Unknown unit type: ${unitType}`);

  const baseMinutes = stats.hatchTimeMinutes;
  const def = CHAMBER_DEFINITIONS[ChamberType.HATCHERY];
  const speedMultiplier = def?.hatcherySpeedPerLevel ?? 0.9;

  const effectiveMinutes = baseMinutes * Math.pow(speedMultiplier, hatcheryLevel);
  return Math.max(1, Math.round(effectiveMinutes));
}

// --- Building Cost ---

/**
 * Calculate the cost to build or upgrade a chamber to a given level.
 */
export function calculateBuildCost(
  baseBiomassCost: number,
  baseWaterCost: number,
  targetLevel: number,
): { biomass: number; water: number } {
  const costMultiplier = Math.pow(targetLevel, 1.5);
  return {
    biomass: Math.floor(baseBiomassCost * costMultiplier),
    water: Math.floor(baseWaterCost * costMultiplier),
  };
}

/**
 * Calculate the build time in minutes for a given level.
 */
export function calculateBuildTime(baseTimeMinutes: number, targetLevel: number): number {
  return Math.floor(baseTimeMinutes * Math.pow(targetLevel, 1.3));
}
