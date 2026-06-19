import { Test, TestingModule } from '@nestjs/testing';
import { EngineService } from './engine.service.js';
import { ProductionService } from './production.service.js';
import { AttritionService } from './attrition.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Unit tests for the Lazy Calculation Engine.
 *
 * Covers:
 * - No-op: hive not found, no time elapsed
 * - Production: biomass, water, heat over time
 * - Heat starvation: scaling when consumption > production (no stored heat)
 * - Stored heat buffer: covering deficit from stored heat
 * - Storage capacity clamping
 * - Edge cases: only Queen chamber, very large time deltas
 */
describe('EngineService', () => {
  let engineService: EngineService;
  let prismaService: jest.Mocked<PrismaService>;

  const FIXED_NOW = new Date('2026-06-19T12:00:00Z');

  const mockHive = {
    id: 'hive-test-1',
    userId: 'user-test-1',
    q: 0,
    r: 0,
    biomass: 500,
    water: 300,
    heat: 100,
    dnaNectar: 0,
    lastUpdated: new Date('2026-06-19T11:00:00Z'),
    chambers: [
      { id: 'ch-1', hiveId: 'hive-test-1', type: 'QUEEN', level: 1, createdAt: FIXED_NOW },
      { id: 'ch-2', hiveId: 'hive-test-1', type: 'MUSHROOM_GARDEN', level: 2, createdAt: FIXED_NOW },
      { id: 'ch-3', hiveId: 'hive-test-1', type: 'HEAT_CHAMBER', level: 3, createdAt: FIXED_NOW },
      { id: 'ch-4', hiveId: 'hive-test-1', type: 'DIGESTIVE_PIT', level: 1, createdAt: FIXED_NOW },
    ],
  };

  function makeChamber(type: string, level: number) {
    return { id: `ch-${type}-${level}`, hiveId: 'hive-test-1', type, level, createdAt: FIXED_NOW };
  }

  beforeEach(async () => {
    const mockPrisma = {
      hive: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      unitBatch: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineService,
        ProductionService,
        AttritionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    engineService = module.get<EngineService>(EngineService);
    prismaService = module.get(PrismaService);
  });

  function getUpdateData() {
    const call = prismaService.hive.update.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    return (call?.data as Record<string, unknown>) ?? {};
  }

  describe('updateHiveState', () => {
    // --- Basic ---

    it('should be defined', () => {
      expect(engineService).toBeDefined();
    });

    it('should return early when hive is not found', async () => {
      prismaService.hive.findUnique.mockResolvedValue(null);

      await engineService.updateHiveState('nonexistent');

      expect(prismaService.hive.update).not.toHaveBeenCalled();
    });

    it('should return early when no time has elapsed', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        lastUpdated: FIXED_NOW,
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      expect(prismaService.hive.update).not.toHaveBeenCalled();
    });

    // --- Production ---

    it('should produce biomass, water, and heat over 1 hour', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // Garden lv2: 40 bio/h → 500+40=540
      expect(data.biomass).toBeCloseTo(540, 0);
      // No Root Siphon → water unchanged at 300
      expect(data.water).toBeCloseTo(300, 0);
      // Heat lv3: 90/h, Queen lv1: 2/h cons → net +88 → 100+88=188, cap 1500
      expect(data.heat).toBeCloseTo(188, 0);
      expect(data.lastUpdated).toEqual(FIXED_NOW);
    });

    it('should handle multiple chamber types simultaneously', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        biomass: 1000,
        water: 1000,
        heat: 500,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 3),           // 6 heat cons/h
          makeChamber('MUSHROOM_GARDEN', 3), // 60 bio/h
          makeChamber('ROOT_SIPHON', 2),     // 40 water/h
          makeChamber('HEAT_CHAMBER', 5),    // 150 heat/h
          makeChamber('DIGESTIVE_PIT', 3),   // cap = 500 + 3000 = 3500
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      expect(data.biomass).toBeCloseTo(1060, 0);
      expect(data.water).toBeCloseTo(1040, 0);
      expect(data.heat).toBeCloseTo(644, 0);
      expect(data.dnaNectar).toBe(0); // Not auto-produced
    });

    it('should handle very large time deltas (72h offline)', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        biomass: 100,
        water: 100,
        heat: 50,
        lastUpdated: new Date(FIXED_NOW.getTime() - 72 * 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 2),           // 4 heat cons/h
          makeChamber('MUSHROOM_GARDEN', 1), // 20 bio/h
          makeChamber('HEAT_CHAMBER', 1),    // 30 heat/h
          makeChamber('DIGESTIVE_PIT', 2),   // cap = 500 + 2000 = 2500
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // 100 + 20*72 = 1540, cap 2500 → 1540
      expect(data.biomass).toBeCloseTo(1540, 0);
      // 50 + (30-4)*72 = 50 + 1872 = 1922
      expect(data.heat).toBeCloseTo(1922, 0);
    });

    // --- Storage Clamping ---

    it('should clamp biomass to storage capacity', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        biomass: 1450,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 1),
          makeChamber('MUSHROOM_GARDEN', 5), // 100 bio/h
          makeChamber('DIGESTIVE_PIT', 1),   // cap = 1500
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // 1450 + 100 = 1550, but cap is 1500
      expect(data.biomass).toBe(1500);
    });

    // --- Heat Starvation ---

    it('should scale down production when heat-starved with no stored heat', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        heat: 0,
        biomass: 500,
        water: 300,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 20),             // 40 heat cons/h
          makeChamber('MUSHROOM_GARDEN', 2),    // 40 bio/h
          makeChamber('HEAT_CHAMBER', 1),       // 30 heat/h
          makeChamber('DIGESTIVE_PIT', 2),      // cap = 2500
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // netHeat = 30 - 40 = -10 (negative, no stored heat → scaling)
      // scaleFactor = 30/40 = 0.75
      // biomass: 500 + 40*0.75 = 530
      expect(data.biomass).toBeCloseTo(530, 0);
      // heat: max(0, 0 + (-10)) = 0
      expect(data.heat).toBe(0);
    });

    it('should halt all production when completely heat-starved (zero heat production)', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        heat: 0,
        biomass: 500,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 10),              // 20 heat cons/h
          makeChamber('MUSHROOM_GARDEN', 2),     // 40 bio/h
          // No HEAT_CHAMBER at all
          makeChamber('DIGESTIVE_PIT', 1),
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // netHeat = 0 - 20 = -20, scaleFactor = 0/20 = 0
      // biomass: 500 + 40*0 = 500 (no production)
      expect(data.biomass).toBeCloseTo(500, 0);
      // heat: max(0, 0 + (-20)) = 0
      expect(data.heat).toBe(0);
    });

    it('should use stored heat buffer to avoid scaling when consumption exceeds production', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        heat: 100, // Enough stored heat to cover the deficit for hours
        biomass: 500,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 20),             // 40 heat cons/h
          makeChamber('MUSHROOM_GARDEN', 2),    // 40 bio/h
          makeChamber('HEAT_CHAMBER', 1),       // 30 heat/h
          makeChamber('DIGESTIVE_PIT', 2),
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // netHeat = 30 - 40 = -10 (negative, BUT stored heat > 0 → no scaling)
      // When stored heat covers deficit, production runs at 100%
      // biomass: 500 + 40 = 540
      expect(data.biomass).toBeCloseTo(540, 0);
      // heat: max(0, 100 + (-10)) = 90 (stored heat drains by 10)
      expect(data.heat).toBeCloseTo(90, 0);
    });

    // --- Edge Cases ---

    it('should handle a fresh hive with only Queen chamber', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        heat: 200,
        biomass: 500,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
        chambers: [
          makeChamber('QUEEN', 2), // 4 heat cons/h, no production chambers
        ],
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      const data = getUpdateData();
      // No production → biomass unchanged
      expect(data.biomass).toBeCloseTo(500, 0);
      // heat: 200 - 4 = 196 (only consumption, no production, base cap 500)
      expect(data.heat).toBeCloseTo(196, 0);
    });

    it('should update lastUpdated to targetTimestamp', async () => {
      prismaService.hive.findUnique.mockResolvedValue({
        ...mockHive,
        lastUpdated: new Date(FIXED_NOW.getTime() - 60 * 60 * 1000),
      });

      await engineService.updateHiveState('hive-test-1', FIXED_NOW);

      expect(getUpdateData().lastUpdated).toEqual(FIXED_NOW);
    });
  });
});
