import { Test, TestingModule } from '@nestjs/testing';
import { PheromoneService } from './pheromone.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WsGateway } from '../ws/ws.gateway.js';
import { PheromoneType } from '@a-raj/shared';
import { WsEvent } from '@a-raj/shared';
import type { HexCoord } from '@a-raj/shared';

/**
 * Unit tests for PheromoneService.
 *
 * Covers:
 * - drawTrail: invalid type, path too short, path too long, not in clan,
 *   not LEADER/OFFICER, successful draw with WS broadcast, expired trail cleanup
 * - getActiveTrails: returns non-expired trails, filters expired ones
 * - broadcastDrawing: delegates to WsGateway
 */
describe('PheromoneService', () => {
  let pheromoneService: PheromoneService;
  let prisma: jest.Mocked<{
    feromonTrail: jest.Mocked<{
      findMany: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    }>;
    clanMember: jest.Mocked<{
      findUnique: jest.Mock;
    }>;
  }>;
  let wsGateway: jest.Mocked<Partial<WsGateway>> & { server: jest.Mocked<{ to: jest.Mock }> };

  const FIXED_DATE = new Date('2026-06-19T12:00:00Z');
  const mockUserId = 'user-leader-1';
  const mockClanId = 'clan-test-1';
  const mockHexPath: HexCoord[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: -1 },
  ];

  beforeEach(async () => {
    const mockWsGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      },
    };

    const mockPrisma = {
      feromonTrail: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      clanMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PheromoneService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WsGateway, useValue: mockWsGateway },
      ],
    }).compile();

    pheromoneService = module.get<PheromoneService>(PheromoneService);
    prisma = module.get(PrismaService);
    wsGateway = module.get(WsGateway);
  });

  // ==================== drawTrail ====================

  describe('drawTrail', () => {
    it('should throw for invalid pheromone type', async () => {
      await expect(
        pheromoneService.drawTrail(
          mockUserId,
          mockHexPath,
          'INVALID' as PheromoneType,
        ),
      ).rejects.toThrow('Invalid pheromone type');
    });

    it('should throw if path has fewer than 2 points', async () => {
      await expect(
        pheromoneService.drawTrail(
          mockUserId,
          [{ q: 0, r: 0 }],
          PheromoneType.ATTACK,
        ),
      ).rejects.toThrow('Path must have at least 2 points');
    });

    it('should throw if path is empty', async () => {
      await expect(
        pheromoneService.drawTrail(mockUserId, [], PheromoneType.ATTACK),
      ).rejects.toThrow('Path must have at least 2 points');
    });

    it('should throw if path exceeds 50 points', async () => {
      const longPath: HexCoord[] = Array.from({ length: 51 }, (_, i) => ({
        q: i,
        r: 0,
      }));

      await expect(
        pheromoneService.drawTrail(
          mockUserId,
          longPath,
          PheromoneType.DEFEND,
        ),
      ).rejects.toThrow('Path cannot exceed 50 points');
    });

    it('should accept a path with exactly 50 points', async () => {
      const exactPath: HexCoord[] = Array.from({ length: 50 }, (_, i) => ({
        q: i,
        r: 0,
      }));

      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: 'LEADER',
        joinedAt: FIXED_DATE,
      });

      prisma.feromonTrail.deleteMany.mockResolvedValue({ count: 0 });

      prisma.feromonTrail.create.mockResolvedValue({
        id: 'trail-1',
        clanId: mockClanId,
        type: PheromoneType.ATTACK,
        path: exactPath,
        expiresAt: new Date(FIXED_DATE.getTime() + 8 * 3600 * 1000),
        createdBy: mockUserId,
        createdAt: FIXED_DATE,
      });

      const result = await pheromoneService.drawTrail(
        mockUserId,
        exactPath,
        PheromoneType.ATTACK,
      );

      expect(result.path).toHaveLength(50);
      expect(result.type).toBe(PheromoneType.ATTACK);
    });

    it('should throw if user is not in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);

      await expect(
        pheromoneService.drawTrail(
          mockUserId,
          mockHexPath,
          PheromoneType.ATTACK,
        ),
      ).rejects.toThrow('You are not in a clan');
    });

    it('should throw if user is MEMBER (not LEADER/OFFICER)', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-member',
        clanId: mockClanId,
        userId: mockUserId,
        role: 'MEMBER',
        joinedAt: FIXED_DATE,
      });

      await expect(
        pheromoneService.drawTrail(
          mockUserId,
          mockHexPath,
          PheromoneType.ATTACK,
        ),
      ).rejects.toThrow('Only Leader or Officer can draw pheromone trails');
    });

    it('should allow LEADER to draw a trail', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: 'LEADER',
        joinedAt: FIXED_DATE,
      });

      prisma.feromonTrail.deleteMany.mockResolvedValue({ count: 2 });

      const createdTrail = {
        id: 'trail-1',
        clanId: mockClanId,
        type: PheromoneType.ATTACK,
        path: mockHexPath,
        expiresAt: new Date(FIXED_DATE.getTime() + 8 * 3600 * 1000),
        createdBy: mockUserId,
        createdAt: FIXED_DATE,
      };

      prisma.feromonTrail.create.mockResolvedValue(createdTrail);

      const result = await pheromoneService.drawTrail(
        mockUserId,
        mockHexPath,
        PheromoneType.ATTACK,
      );

      expect(result.id).toBe('trail-1');
      expect(result.type).toBe(PheromoneType.ATTACK);
      expect(result.clanId).toBe(mockClanId);
      expect(result.createdBy).toBe(mockUserId);
      expect(result.path).toEqual(mockHexPath);

      // Verify expired trails were cleaned up
      expect(prisma.feromonTrail.deleteMany).toHaveBeenCalled();

      // Verify WebSocket broadcast
      expect(wsGateway.server.to).toHaveBeenCalledWith(`clan:${mockClanId}`);
    });

    it('should allow OFFICER to draw a trail', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-officer',
        clanId: mockClanId,
        userId: mockUserId,
        role: 'OFFICER',
        joinedAt: FIXED_DATE,
      });

      prisma.feromonTrail.deleteMany.mockResolvedValue({ count: 0 });

      const createdTrail = {
        id: 'trail-2',
        clanId: mockClanId,
        type: PheromoneType.DEFEND,
        path: mockHexPath,
        expiresAt: new Date(FIXED_DATE.getTime() + 8 * 3600 * 1000),
        createdBy: mockUserId,
        createdAt: FIXED_DATE,
      };

      prisma.feromonTrail.create.mockResolvedValue(createdTrail);

      const result = await pheromoneService.drawTrail(
        mockUserId,
        mockHexPath,
        PheromoneType.DEFEND,
      );

      expect(result.type).toBe(PheromoneType.DEFEND);
      expect(result.id).toBe('trail-2');
    });

    it('should broadcast to clan room via WebSocket on successful draw', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: 'LEADER',
        joinedAt: FIXED_DATE,
      });

      prisma.feromonTrail.deleteMany.mockResolvedValue({ count: 0 });

      prisma.feromonTrail.create.mockResolvedValue({
        id: 'trail-3',
        clanId: mockClanId,
        type: PheromoneType.ATTACK,
        path: mockHexPath,
        expiresAt: new Date(FIXED_DATE.getTime() + 8 * 3600 * 1000),
        createdBy: mockUserId,
        createdAt: FIXED_DATE,
      });

      const roomEmit = jest.fn();
      wsGateway.server.to.mockReturnValue({ emit: roomEmit });

      await pheromoneService.drawTrail(
        mockUserId,
        mockHexPath,
        PheromoneType.ATTACK,
      );

      expect(wsGateway.server.to).toHaveBeenCalledWith(`clan:${mockClanId}`);
      expect(roomEmit).toHaveBeenCalledWith(
        WsEvent.PHEROMONE_DRAW,
        expect.objectContaining({
          type: PheromoneType.ATTACK,
          clanId: mockClanId,
        }),
      );
    });
  });

  // ==================== getActiveTrails ====================

  describe('getActiveTrails', () => {
    it('should return only non-expired trails', async () => {
      const futureDate = new Date(FIXED_DATE.getTime() + 10 * 3600 * 1000);

      prisma.feromonTrail.findMany.mockResolvedValue([
        {
          id: 'trail-1',
          clanId: mockClanId,
          type: PheromoneType.ATTACK,
          path: mockHexPath,
          expiresAt: futureDate,
          createdBy: mockUserId,
          createdAt: FIXED_DATE,
        },
        {
          id: 'trail-2',
          clanId: mockClanId,
          type: PheromoneType.DEFEND,
          path: [{ q: 5, r: -2 }, { q: 6, r: -2 }],
          expiresAt: futureDate,
          createdBy: mockUserId,
          createdAt: FIXED_DATE,
        },
      ]);

      const result = await pheromoneService.getActiveTrails(mockClanId);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(PheromoneType.ATTACK);
      expect(result[1].type).toBe(PheromoneType.DEFEND);
      // Each trail should have the correct shape
      expect(result[0].path).toEqual(mockHexPath);
    });

    it('should filter out expired trails via Prisma query (gt: now)', async () => {
      prisma.feromonTrail.findMany.mockResolvedValue([]);

      const result = await pheromoneService.getActiveTrails(mockClanId);

      expect(result).toEqual([]);
      // Verify the query filters by expiry
      expect(prisma.feromonTrail.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            clanId: mockClanId,
            expiresAt: { gt: expect.any(Date) },
          },
        }),
      );
    });

    it('should return trails ordered by createdAt desc', async () => {
      prisma.feromonTrail.findMany.mockResolvedValue([]);

      await pheromoneService.getActiveTrails(mockClanId);

      expect(prisma.feromonTrail.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // ==================== broadcastDrawing ====================

  describe('broadcastDrawing', () => {
    it('should broadcast partial path to clan room for live preview', () => {
      const roomEmit = jest.fn();
      wsGateway.server.to.mockReturnValue({ emit: roomEmit });

      const partialPath: HexCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
      ];

      pheromoneService.broadcastDrawing(
        mockClanId,
        mockUserId,
        partialPath,
        PheromoneType.ATTACK,
      );

      expect(wsGateway.server.to).toHaveBeenCalledWith(`clan:${mockClanId}`);
      expect(roomEmit).toHaveBeenCalledWith(WsEvent.PHEROMONE_VISIBLE, {
        userId: mockUserId,
        partialPath,
        type: PheromoneType.ATTACK,
      });
    });
  });
});
