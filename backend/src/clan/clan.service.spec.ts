import { Test, TestingModule } from '@nestjs/testing';
import { ClanService } from './clan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClanRole, DiplomacyStatus } from '@a-raj/shared';

/**
 * Unit tests for ClanService.
 *
 * Covers:
 * - createClan: validation, duplicate checks, successful creation
 * - joinClan: existing membership, clan not found, P2002 race condition, success
 * - leaveClan: not in clan, leader with members, leader alone (disband), member leaves
 * - promoteMember: invalid role, not leader, not same clan, already same role, promote to OFFICER, promote to LEADER (demote old leader)
 * - tradeResources: invalid type, zero/negative amount, self-trade, not same clan, insufficient resources, success
 * - setDiplomacy: invalid status, not in clan, not leader/officer, own clan, target not found, upsert success
 * - getDiplomacies / getDiplomaciesForUser
 */
describe('ClanService', () => {
  let clanService: ClanService;
  let prisma: jest.Mocked<{
    clan: jest.Mocked<{
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    }>;
    clanMember: jest.Mocked<{
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    }>;
    clanDiplomacy: jest.Mocked<{
      findMany: jest.Mock;
      upsert: jest.Mock;
    }>;
    clanTrade: jest.Mocked<{
      create: jest.Mock;
    }>;
    hive: jest.Mocked<{
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    }>;
    $transaction: jest.Mock;
  }>;

  const FIXED_DATE = new Date('2026-06-19T12:00:00Z');

  const mockUserId = 'user-leader-1';
  const mockUserId2 = 'user-member-2';
  const mockUserId3 = 'user-other-3';
  const mockClanId = 'clan-test-1';
  const mockClanId2 = 'clan-test-2';

  beforeEach(async () => {
    const mockPrisma = {
      clan: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      clanMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      clanDiplomacy: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      clanTrade: {
        create: jest.fn(),
      },
      hive: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClanService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    clanService = module.get<ClanService>(ClanService);
    prisma = module.get(PrismaService);
  });

  // ==================== createClan ====================

  describe('createClan', () => {
    it('should throw if name is less than 2 characters', async () => {
      await expect(
        clanService.createClan(mockUserId, 'A', '', '#cc3333'),
      ).rejects.toThrow('Clan name must be at least 2 characters');
    });

    it('should throw if name is more than 30 characters', async () => {
      await expect(
        clanService.createClan(mockUserId, 'A'.repeat(31), '', '#cc3333'),
      ).rejects.toThrow('Clan name must be at most 30 characters');
    });

    it('should throw if user is already in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-1',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
      });

      await expect(
        clanService.createClan(mockUserId, 'TestClan', '', '#cc3333'),
      ).rejects.toThrow('You are already in a clan');
    });

    it('should throw if clan name is already taken', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null); // not in clan
      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId,
        name: 'TestClan',
        description: '',
        colorHex: '#cc3333',
        level: 1,
        createdAt: FIXED_DATE,
      });

      await expect(
        clanService.createClan(mockUserId, 'TestClan', '', '#cc3333'),
      ).rejects.toThrow('Clan name is already taken');
    });

    it('should create clan and leader membership in a transaction', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);
      prisma.clan.findUnique.mockResolvedValue(null);

      const createdClan = {
        id: mockClanId,
        name: 'TestClan',
        description: 'A test clan',
        colorHex: '#cc3333',
      };

      const createdMember = {
        id: 'cm-1',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
        user: { username: 'testuser' },
      };

      prisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          clan: { create: jest.fn().mockResolvedValue(createdClan) },
          clanMember: {
            create: jest.fn().mockResolvedValue(createdMember),
          },
        }),
      );

      const result = await clanService.createClan(
        mockUserId,
        'TestClan',
        'A test clan',
        '#cc3333',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.clan.name).toBe('TestClan');
      expect(result.clan.memberCount).toBe(1);
      expect(result.clan.leaderId).toBe(mockUserId);
      expect(result.member.role).toBe(ClanRole.LEADER);
      expect(result.member.username).toBe('testuser');
    });

    it('should trim name and use default colorHex if not provided', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);
      prisma.clan.findUnique.mockResolvedValue(null);

      const createdClan = {
        id: mockClanId,
        name: 'Trimmed',
        description: '',
        colorHex: '#cc3333',
      };

      const createdMember = {
        id: 'cm-1',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
        user: { username: 'testuser' },
      };

      prisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          clan: { create: jest.fn().mockResolvedValue(createdClan) },
          clanMember: {
            create: jest.fn().mockResolvedValue(createdMember),
          },
        }),
      );

      const result = await clanService.createClan(
        mockUserId,
        '  Trimmed  ',
        '',
        '',
      );

      expect(result.clan.name).toBe('Trimmed');
    });
  });

  // ==================== joinClan ====================

  describe('joinClan', () => {
    it('should throw if user is already in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-1',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
      });

      await expect(
        clanService.joinClan(mockUserId, mockClanId2),
      ).rejects.toThrow('You are already in a clan');
    });

    it('should throw if clan not found', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);
      prisma.clan.findUnique.mockResolvedValue(null);

      await expect(
        clanService.joinClan(mockUserId, 'nonexistent'),
      ).rejects.toThrow('Clan not found');
    });

    it('should successfully join a clan as MEMBER', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);
      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId,
        name: 'TestClan',
        description: '',
        colorHex: '#cc3333',
      });

      prisma.clanMember.create.mockResolvedValue({
        id: 'cm-new',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
        user: { username: 'newmember' },
      });

      const result = await clanService.joinClan(mockUserId, mockClanId);

      expect(result.role).toBe(ClanRole.MEMBER);
      expect(result.username).toBe('newmember');
      expect(result.userId).toBe(mockUserId);
    });

    it('should handle P2002 race condition gracefully', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);
      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId,
        name: 'TestClan',
        description: '',
        colorHex: '#cc3333',
      });

      const p2002Error = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      prisma.clanMember.create.mockRejectedValue(p2002Error);

      await expect(
        clanService.joinClan(mockUserId, mockClanId),
      ).rejects.toThrow('You are already in a clan');
    });
  });

  // ==================== leaveClan ====================

  describe('leaveClan', () => {
    it('should throw if user is not in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);

      await expect(clanService.leaveClan(mockUserId)).rejects.toThrow(
        'You are not in a clan',
      );
    });

    it('should throw if LEADER tries to leave with other members', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
        clan: {
          id: mockClanId,
          name: 'TestClan',
          members: [
            {
              id: 'cm-leader',
              userId: mockUserId,
              clanId: mockClanId,
              role: ClanRole.LEADER,
            },
            {
              id: 'cm-other',
              userId: mockUserId2,
              clanId: mockClanId,
              role: ClanRole.MEMBER,
            },
          ],
        },
      });

      await expect(clanService.leaveClan(mockUserId)).rejects.toThrow(
        'You are the Leader',
      );
    });

    it('should disband clan when LEADER leaves and is the last member', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
        clan: {
          id: mockClanId,
          name: 'TestClan',
          members: [
            {
              id: 'cm-leader',
              userId: mockUserId,
              clanId: mockClanId,
              role: ClanRole.LEADER,
            },
          ],
        },
      });

      prisma.clan.delete.mockResolvedValue({ id: mockClanId });

      await expect(
        clanService.leaveClan(mockUserId),
      ).resolves.toBeUndefined();

      expect(prisma.clan.delete).toHaveBeenCalledWith({
        where: { id: mockClanId },
      });
    });

    it('should let a regular MEMBER leave', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-member',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
        clan: {
          id: mockClanId,
          name: 'TestClan',
          members: [],
        },
      });

      prisma.clanMember.delete.mockResolvedValue({ id: 'cm-member' });

      await expect(
        clanService.leaveClan(mockUserId),
      ).resolves.toBeUndefined();

      expect(prisma.clanMember.delete).toHaveBeenCalledWith({
        where: { id: 'cm-member' },
      });
    });
  });

  // ==================== promoteMember ====================

  describe('promoteMember', () => {
    it('should throw for invalid role', async () => {
      await expect(
        clanService.promoteMember(
          mockUserId,
          mockUserId2,
          'INVALID' as ClanRole,
        ),
      ).rejects.toThrow('Invalid role');
    });

    it('should throw if caller is not a LEADER', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-member',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
      });

      await expect(
        clanService.promoteMember(
          mockUserId,
          mockUserId2,
          ClanRole.OFFICER,
        ),
      ).rejects.toThrow('Only the Clan Leader can promote members');
    });

    it('should throw if target does not exist at all', async () => {
      // Caller is leader
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-leader',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.LEADER,
          joinedAt: FIXED_DATE,
        })
        // Target lookup - user not found
        .mockResolvedValueOnce(null);

      await expect(
        clanService.promoteMember(
          mockUserId,
          'nonexistent-user',
          ClanRole.OFFICER,
        ),
      ).rejects.toThrow('Member not found in your clan');
    });

    it('should throw if target is not in the same clan', async () => {
      // Caller is leader
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-leader',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.LEADER,
          joinedAt: FIXED_DATE,
        })
        // Target lookup - different clan
        .mockResolvedValueOnce({
          id: 'cm-other',
          clanId: 'other-clan',
          userId: mockUserId2,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          user: { username: 'other' },
        });

      await expect(
        clanService.promoteMember(
          mockUserId,
          mockUserId2,
          ClanRole.OFFICER,
        ),
      ).rejects.toThrow('Member not found in your clan');
    });

    it('should throw if target already has the new role', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-leader',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.LEADER,
          joinedAt: FIXED_DATE,
        })
        .mockResolvedValueOnce({
          id: 'cm-officer',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.OFFICER,
          joinedAt: FIXED_DATE,
          user: { username: 'officer' },
        });

      await expect(
        clanService.promoteMember(
          mockUserId,
          mockUserId2,
          ClanRole.OFFICER,
        ),
      ).rejects.toThrow('Member already has role OFFICER');
    });

    it('should promote a MEMBER to OFFICER', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-leader',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.LEADER,
          joinedAt: FIXED_DATE,
        })
        .mockResolvedValueOnce({
          id: 'cm-member',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          user: { username: 'newOfficer' },
        });

      const updatedMember = {
        id: 'cm-member',
        clanId: mockClanId,
        userId: mockUserId2,
        role: ClanRole.OFFICER,
        joinedAt: FIXED_DATE,
        user: { username: 'newOfficer' },
      };

      prisma.$transaction.mockImplementation(async (fn: Function) =>
        fn({
          clanMember: {
            update: jest.fn().mockResolvedValue(updatedMember),
          },
        }),
      );

      const result = await clanService.promoteMember(
        mockUserId,
        mockUserId2,
        ClanRole.OFFICER,
      );

      expect(result.role).toBe(ClanRole.OFFICER);
      expect(result.username).toBe('newOfficer');
    });

    it('should demote existing leader when promoting someone to LEADER', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-leader',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.LEADER,
          joinedAt: FIXED_DATE,
        })
        .mockResolvedValueOnce({
          id: 'cm-officer',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.OFFICER,
          joinedAt: FIXED_DATE,
          user: { username: 'newLeader' },
        });

      const updatedTarget = {
        id: 'cm-officer',
        clanId: mockClanId,
        userId: mockUserId2,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
        user: { username: 'newLeader' },
      };

      let leaderUpdated = false;
      let targetUpdated = false;

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          clanMember: {
            update: jest.fn().mockImplementation((args: { where: { id: string } }) => {
              if (args.where.id === 'cm-leader') {
                leaderUpdated = true;
                return Promise.resolve({
                  id: 'cm-leader',
                  clanId: mockClanId,
                  userId: mockUserId,
                  role: ClanRole.OFFICER,
                  joinedAt: FIXED_DATE,
                  user: { username: 'oldLeader' },
                });
              }
              if (args.where.id === 'cm-officer') {
                targetUpdated = true;
                return Promise.resolve(updatedTarget);
              }
              return Promise.resolve(null);
            }),
          },
        };
        return fn(tx);
      });

      const result = await clanService.promoteMember(
        mockUserId,
        mockUserId2,
        ClanRole.LEADER,
      );

      expect(leaderUpdated).toBe(true);
      expect(targetUpdated).toBe(true);
      expect(result.role).toBe(ClanRole.LEADER);
    });
  });

  // ==================== tradeResources ====================

  describe('tradeResources', () => {
    it('should throw for invalid resource type', async () => {
      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'GOLD', 100),
      ).rejects.toThrow('Invalid resource type');
    });

    it('should throw for zero amount', async () => {
      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'BIOMASS', 0),
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw for negative amount', async () => {
      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'BIOMASS', -50),
      ).rejects.toThrow('Amount must be a positive number');
    });

    it('should throw for self-trade', async () => {
      await expect(
        clanService.tradeResources(mockUserId, mockUserId, 'BIOMASS', 100),
      ).rejects.toThrow('Cannot trade with yourself');
    });

    it('should throw if sender is not in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);

      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'BIOMASS', 100),
      ).rejects.toThrow('You are not in a clan');
    });

    it('should throw if receiver is not in same clan', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-1',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          clan: { id: mockClanId, name: 'ClanA' },
        })
        .mockResolvedValueOnce(null); // receiver not in clan

      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'BIOMASS', 100),
      ).rejects.toThrow('Target user is not in your clan');
    });

    it('should throw if sender has insufficient resources', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-1',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          clan: { id: mockClanId, name: 'ClanA' },
        })
        .mockResolvedValueOnce({
          id: 'cm-2',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
        });

      prisma.hive.findFirst
        .mockResolvedValueOnce({
          id: 'hive-1',
          userId: mockUserId,
          biomass: 50, // not enough for 100
          water: 200,
          dnaNectar: 10,
        })
        .mockResolvedValueOnce({
          id: 'hive-2',
          userId: mockUserId2,
          biomass: 300,
          water: 200,
          dnaNectar: 10,
        });

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          hive: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'hive-1',
              userId: mockUserId,
              biomass: 50,
            }),
            update: jest.fn(),
          },
          clanTrade: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(
        clanService.tradeResources(mockUserId, mockUserId2, 'BIOMASS', 100),
      ).rejects.toThrow('Not enough BIOMASS');
    });

    it('should successfully trade resources in a transaction', async () => {
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-1',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          clan: { id: mockClanId, name: 'ClanA' },
        })
        .mockResolvedValueOnce({
          id: 'cm-2',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
        });

      prisma.hive.findFirst
        .mockResolvedValueOnce({
          id: 'hive-1',
          userId: mockUserId,
          biomass: 500,
          water: 200,
          dnaNectar: 10,
        })
        .mockResolvedValueOnce({
          id: 'hive-2',
          userId: mockUserId2,
          biomass: 300,
          water: 200,
          dnaNectar: 10,
        });

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          hive: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'hive-1',
              userId: mockUserId,
              biomass: 500,
            }),
            update: jest
              .fn()
              .mockResolvedValueOnce({ id: 'hive-1', biomass: 400 })
              .mockResolvedValueOnce({ id: 'hive-2', biomass: 400 }),
          },
          clanTrade: {
            create: jest.fn().mockResolvedValue({
              id: 'trade-1',
              clanId: mockClanId,
              fromUserId: mockUserId,
              toUserId: mockUserId2,
              resourceType: 'BIOMASS',
              amount: 100,
            }),
          },
        };
        return fn(tx);
      });

      const result = await clanService.tradeResources(
        mockUserId,
        mockUserId2,
        'BIOMASS',
        100,
      );

      expect(result.tradeId).toBe('trade-1');
      expect(result.fromBalance).toBe(400);
      expect(result.toBalance).toBe(400);
    });

    it('should support all valid resource types', async () => {
      // BIOMASS, WATER, DNA_NECTAR are all valid
      // Setup mocks for WATER trade
      prisma.clanMember.findUnique
        .mockResolvedValueOnce({
          id: 'cm-1',
          clanId: mockClanId,
          userId: mockUserId,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
          clan: { id: mockClanId, name: 'ClanA' },
        })
        .mockResolvedValueOnce({
          id: 'cm-2',
          clanId: mockClanId,
          userId: mockUserId2,
          role: ClanRole.MEMBER,
          joinedAt: FIXED_DATE,
        });

      prisma.hive.findFirst
        .mockResolvedValueOnce({
          id: 'hive-1',
          userId: mockUserId,
          biomass: 500,
          water: 500,
          dnaNectar: 50,
        })
        .mockResolvedValueOnce({
          id: 'hive-2',
          userId: mockUserId2,
          biomass: 300,
          water: 100,
          dnaNectar: 5,
        });

      prisma.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          hive: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'hive-1',
              userId: mockUserId,
              water: 500,
            }),
            update: jest
              .fn()
              .mockResolvedValueOnce({ id: 'hive-1', water: 400 })
              .mockResolvedValueOnce({ id: 'hive-2', water: 200 }),
          },
          clanTrade: {
            create: jest.fn().mockResolvedValue({
              id: 'trade-2',
              clanId: mockClanId,
              fromUserId: mockUserId,
              toUserId: mockUserId2,
              resourceType: 'WATER',
              amount: 100,
            }),
          },
        };
        return fn(tx);
      });

      const result = await clanService.tradeResources(
        mockUserId,
        mockUserId2,
        'WATER',
        100,
      );

      expect(result.tradeId).toBe('trade-2');
    });
  });

  // ==================== Diplomacy ====================

  describe('setDiplomacy', () => {
    it('should throw for invalid status', async () => {
      await expect(
        clanService.setDiplomacy(mockUserId, mockClanId2, 'INVALID' as DiplomacyStatus),
      ).rejects.toThrow('Invalid diplomacy status');
    });

    it('should throw if user is not in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);

      await expect(
        clanService.setDiplomacy(mockUserId, mockClanId2, DiplomacyStatus.ALLY),
      ).rejects.toThrow('You are not in a clan');
    });

    it('should throw if user is a regular MEMBER (not LEADER/OFFICER)', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-member',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.MEMBER,
        joinedAt: FIXED_DATE,
      });

      await expect(
        clanService.setDiplomacy(mockUserId, mockClanId2, DiplomacyStatus.ALLY),
      ).rejects.toThrow('Only Leader or Officer can set diplomacy');
    });

    it('should throw if trying to set diplomacy with own clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
      });

      await expect(
        clanService.setDiplomacy(mockUserId, mockClanId, DiplomacyStatus.ALLY),
      ).rejects.toThrow('Cannot set diplomacy with your own clan');
    });

    it('should throw if target clan not found', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
      });

      prisma.clan.findUnique.mockResolvedValue(null);

      await expect(
        clanService.setDiplomacy(
          mockUserId,
          'nonexistent',
          DiplomacyStatus.ALLY,
        ),
      ).rejects.toThrow('Target clan not found');
    });

    it('should upsert diplomacy as LEADER', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-leader',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.LEADER,
        joinedAt: FIXED_DATE,
      });

      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId2,
        name: 'OtherClan',
        description: '',
        colorHex: '#33cc33',
      });

      prisma.clanDiplomacy.upsert.mockResolvedValue({
        id: 'dipl-1',
        clanId: mockClanId,
        targetClanId: mockClanId2,
        status: DiplomacyStatus.ALLY,
        setAt: FIXED_DATE,
      });

      const result = await clanService.setDiplomacy(
        mockUserId,
        mockClanId2,
        DiplomacyStatus.ALLY,
      );

      expect(result.status).toBe(DiplomacyStatus.ALLY);
      expect(result.clanId).toBe(mockClanId);
      expect(result.targetClanId).toBe(mockClanId2);
      expect(prisma.clanDiplomacy.upsert).toHaveBeenCalled();
    });

    it('should allow OFFICER to set diplomacy', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-officer',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.OFFICER,
        joinedAt: FIXED_DATE,
      });

      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId2,
        name: 'OtherClan',
        description: '',
        colorHex: '#33cc33',
      });

      prisma.clanDiplomacy.upsert.mockResolvedValue({
        id: 'dipl-2',
        clanId: mockClanId,
        targetClanId: mockClanId2,
        status: DiplomacyStatus.ENEMY,
        setAt: FIXED_DATE,
      });

      const result = await clanService.setDiplomacy(
        mockUserId,
        mockClanId2,
        DiplomacyStatus.ENEMY,
      );

      expect(result.status).toBe(DiplomacyStatus.ENEMY);
    });
  });

  // ==================== getClan ====================

  describe('getClan', () => {
    it('should throw if clan not found', async () => {
      prisma.clan.findUnique.mockResolvedValue(null);

      await expect(clanService.getClan('nonexistent')).rejects.toThrow(
        'Clan not found',
      );
    });

    it('should return clan with members sorted by joinedAt', async () => {
      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId,
        name: 'TestClan',
        description: 'A test clan',
        colorHex: '#cc3333',
        level: 1,
        createdAt: FIXED_DATE,
        members: [
          {
            id: 'cm-leader',
            clanId: mockClanId,
            userId: mockUserId,
            role: ClanRole.LEADER,
            joinedAt: FIXED_DATE,
            user: { username: 'testuser' },
          },
          {
            id: 'cm-member',
            clanId: mockClanId,
            userId: mockUserId2,
            role: ClanRole.MEMBER,
            joinedAt: new Date(FIXED_DATE.getTime() + 3600 * 1000),
            user: { username: 'newmember' },
          },
        ],
      });

      const result = await clanService.getClan(mockClanId);

      expect(result.clan.name).toBe('TestClan');
      expect(result.clan.memberCount).toBe(2);
      expect(result.clan.leaderId).toBe(mockUserId);
      expect(result.members).toHaveLength(2);
      expect(result.members[0].role).toBe(ClanRole.LEADER);
      expect(result.members[0].username).toBe('testuser');
      expect(result.members[1].role).toBe(ClanRole.MEMBER);
    });

    it('should set leaderId to empty string if no leader found', async () => {
      prisma.clan.findUnique.mockResolvedValue({
        id: mockClanId,
        name: 'EmptyClan',
        description: '',
        colorHex: '#cc3333',
        level: 1,
        createdAt: FIXED_DATE,
        members: [],
      });

      const result = await clanService.getClan(mockClanId);

      expect(result.clan.leaderId).toBe('');
      expect(result.members).toEqual([]);
    });
  });

  // ==================== getDiplomacies ====================

  describe('getDiplomacies', () => {
    it('should return diplomacy list', async () => {
      prisma.clanDiplomacy.findMany.mockResolvedValue([
        {
          id: 'dipl-1',
          clanId: mockClanId,
          targetClanId: mockClanId2,
          status: DiplomacyStatus.ALLY,
          setAt: FIXED_DATE,
          targetClan: { id: mockClanId2, name: 'OtherClan', colorHex: '#33cc33' },
        },
      ]);

      const result = await clanService.getDiplomacies(mockClanId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(DiplomacyStatus.ALLY);
      expect(result[0].targetClanName).toBe('OtherClan');
    });
  });

  describe('getDiplomaciesForUser', () => {
    it('should return empty array if user is not in a clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue(null);

      const result = await clanService.getDiplomaciesForUser(mockUserId);

      expect(result).toEqual([]);
    });

    it('should delegate to getDiplomacies for user in clan', async () => {
      prisma.clanMember.findUnique.mockResolvedValue({
        id: 'cm-officer',
        clanId: mockClanId,
        userId: mockUserId,
        role: ClanRole.OFFICER,
        joinedAt: FIXED_DATE,
      });

      prisma.clanDiplomacy.findMany.mockResolvedValue([
        {
          id: 'dipl-1',
          clanId: mockClanId,
          targetClanId: mockClanId2,
          status: DiplomacyStatus.NAP,
          setAt: FIXED_DATE,
          targetClan: { id: mockClanId2, name: 'PeaceClan', colorHex: '#33cc33' },
        },
      ]);

      const result = await clanService.getDiplomaciesForUser(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(DiplomacyStatus.NAP);
    });
  });
});
