// ============================================================
// A RAJ - Map Seed Script
// Generates the initial world: 50-radius hex grid with
// mountains (10%), lakes (5%), PvE nests (3%), rest EMPTY.
// Run with: npx tsx backend/prisma/map-seed.ts
// ============================================================
/* eslint-disable no-console */

import { PrismaClient } from '@prisma/client';
import { HexType, hexesInRadius, MAP_STARTING_RADIUS, PveNestTier } from '@a-raj/shared';

const prisma = new PrismaClient();

// Seeded random number generator for deterministic world generation
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

async function main() {
  console.log('🌍 Seeding A RAJ world map...');

  // Clear existing map data and PvE nest records
  await prisma.mapHex.deleteMany();
  await prisma.pveNest.deleteMany();

  const center = { q: 0, r: 0 };
  const radius = MAP_STARTING_RADIUS; // 50
  const coords = hexesInRadius(center, radius);

  console.log(`   Generating ${coords.length} hexes (radius ${radius})...`);

  const rand = seededRandom(42); // Fixed seed for reproducible world

  // Use bulk insert for performance
  // Process in batches to avoid overwhelming the database
  const batchSize = 500;
  let inserted = 0;

  // Collect PvE nest coordinates for PveNest record creation
  const pveNestCoords: Array<{ q: number; r: number; tier: string }> = [];

  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize).map(({ q, r }) => {
      const roll = rand();
      let type: HexType;

      if (roll < 0.03) {
        type = HexType.PVE_NEST; // 3% PvE nests
        const tierRoll = rand();
        pveNestCoords.push({
          q,
          r,
          tier:
            tierRoll < 0.50
              ? PveNestTier.EASY
              : tierRoll < 0.85
                ? PveNestTier.MEDIUM
                : PveNestTier.HARD,
        });
      } else if (roll < 0.08) {
        type = HexType.LAKE;      // 5% lakes
      } else if (roll < 0.18) {
        type = HexType.MOUNTAIN;  // 10% mountains
      } else {
        type = HexType.EMPTY;     // 82% empty land
      }

      return { q, r, type };
    });

    await prisma.mapHex.createMany({
      data: batch,
      skipDuplicates: true,
    });

    inserted += batch.length;
  }

  // Create PveNest records with tier-based stats
  console.log(`   Creating ${pveNestCoords.length} PvE nest records with tiers...`);

  for (let i = 0; i < pveNestCoords.length; i += batchSize) {
    const batch = pveNestCoords.slice(i, i + batchSize).map((n) => ({
      q: n.q,
      r: n.r,
      tier: n.tier,
    }));

    await prisma.pveNest.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  const tierCounts = {
    easy: pveNestCoords.filter((n) => n.tier === PveNestTier.EASY).length,
    medium: pveNestCoords.filter((n) => n.tier === PveNestTier.MEDIUM).length,
    hard: pveNestCoords.filter((n) => n.tier === PveNestTier.HARD).length,
  };

  console.log(
    `      EASY: ${tierCounts.easy}, MEDIUM: ${tierCounts.medium}, HARD: ${tierCounts.hard}`,
  );

  // Mark existing hives as HIVE type on the map
  const hives = await prisma.hive.findMany();
  let hiveHexes = 0;

  for (const hive of hives) {
    await prisma.mapHex.upsert({
      where: { q_r: { q: hive.q, r: hive.r } },
      update: { type: HexType.HIVE, hiveId: hive.id },
      create: { q: hive.q, r: hive.r, type: HexType.HIVE, hiveId: hive.id },
    });
    hiveHexes++;
  }

  // Summary
  const total = await prisma.mapHex.count();
  const mountains = await prisma.mapHex.count({ where: { type: HexType.MOUNTAIN } });
  const lakes = await prisma.mapHex.count({ where: { type: HexType.LAKE } });
  const pveNests = await prisma.mapHex.count({ where: { type: HexType.PVE_NEST } });
  const empty = await prisma.mapHex.count({ where: { type: HexType.EMPTY } });

  console.log(`\n✅ Map seed complete: ${total} hexes`);
  console.log(`   ⛰️  Mountains: ${mountains} (${((mountains / total) * 100).toFixed(1)}%)`);
  console.log(`   💧 Lakes:     ${lakes} (${((lakes / total) * 100).toFixed(1)}%)`);
  console.log(`   👾 PvE Nests: ${pveNests} (${((pveNests / total) * 100).toFixed(1)}%)`);
  console.log(`   ⬡ Empty:     ${empty} (${((empty / total) * 100).toFixed(1)}%)`);
  console.log(`   🏠 Hives:     ${hiveHexes}`);
}

main()
  .catch((e) => {
    console.error('Map seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
