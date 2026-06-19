// ============================================================
// A RAJ - Database Seed
// Creates test users, hives, and chambers for development.
// Run with: npm run db:seed -w backend
// ============================================================
/* eslint-disable no-console */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ChamberType, STARTING_RESOURCES } from '@a-raj/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding A RAJ database...');

  // Clean existing data
  await prisma.refreshToken.deleteMany();
  await prisma.chamber.deleteMany();
  await prisma.hive.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('test123', 10);

  // --- Test Users ---

  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      passwordHash,
      premiumTier: 'FREE',
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      passwordHash,
      premiumTier: 'PREMIUM',
    },
  });

  const charlie = await prisma.user.create({
    data: {
      username: 'charlie',
      passwordHash,
      premiumTier: 'FREE',
    },
  });

  console.log(`👤 Users: alice (FREE), bob (PREMIUM), charlie (FREE)`);

  // --- Hive 1: Alice - Basic starter hive (just Queen chamber) ---

  await prisma.hive.create({
    data: {
      userId: alice.id,
      q: 0,
      r: 0,
      biomass: STARTING_RESOURCES.biomass,
      water: STARTING_RESOURCES.water,
      heat: STARTING_RESOURCES.heat,
      dnaNectar: STARTING_RESOURCES.dnaNectar,
      lastUpdated: new Date(),
      chambers: {
        create: {
          type: ChamberType.QUEEN,
          level: 1,
        },
      },
    },
  });

  console.log('🏠 Alice: Basic hive at (0,0)');

  // --- Hive 2: Bob - Mid-game hive with production chambers ---

  await prisma.hive.create({
    data: {
      userId: bob.id,
      q: 3,
      r: -2,
      biomass: 2000,
      water: 1500,
      heat: 500,
      dnaNectar: 50,
      lastUpdated: new Date(),
      chambers: {
        create: [
          { type: ChamberType.QUEEN, level: 3 },
          { type: ChamberType.MUSHROOM_GARDEN, level: 4 },
          { type: ChamberType.ROOT_SIPHON, level: 3 },
          { type: ChamberType.HEAT_CHAMBER, level: 2 },
          { type: ChamberType.DIGESTIVE_PIT, level: 2 },
          { type: ChamberType.HATCHERY, level: 1 },
          { type: ChamberType.ACID_GLAND, level: 1 },
        ],
      },
    },
  });

  console.log('🏠 Bob: Mid-game hive at (3,-2) [Queen 3, Garden 4, Siphon 3, Heat 2, Pit 2, Hatchery 1, Acid 1]');

  // --- Hive 3: Charlie - Hive with outdated lastUpdated (test lazy calc) ---

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  await prisma.hive.create({
    data: {
      userId: charlie.id,
      q: -2,
      r: 4,
      biomass: 1000,
      water: 800,
      heat: 200,
      dnaNectar: 10,
      lastUpdated: twoHoursAgo, // 2 hours in the past
      chambers: {
        create: [
          { type: ChamberType.QUEEN, level: 2 },
          { type: ChamberType.MUSHROOM_GARDEN, level: 5 }, // 5 * 20 = 100 bio/h
          { type: ChamberType.ROOT_SIPHON, level: 3 },     // 3 * 20 = 60 water/h
          { type: ChamberType.HEAT_CHAMBER, level: 4 },    // 4 * 30 = 120 heat/h
          { type: ChamberType.DIGESTIVE_PIT, level: 3 },   // 500 + 3 * 1000 = 3500 cap
        ],
      },
    },
  });

  console.log('🏠 Charlie: Hive at (-2,4) [lastUpdated 2h ago for lazy calc testing]');
  console.log('   Production: 100 bio/h, 60 water/h, 120 heat/h, Queen heat cons: 4/h');
  console.log('   After 2h: +200 bio, +120 water, heat net +232 (120-4)*2 - clamped by storage');

  // --- Summary ---
  const userCount = await prisma.user.count();
  const hiveCount = await prisma.hive.count();
  const chamberCount = await prisma.chamber.count();

  console.log(`\n✅ Seed complete: ${userCount} users, ${hiveCount} hives, ${chamberCount} chambers`);
  console.log('🔑 Test passwords: "test123" for all users');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
