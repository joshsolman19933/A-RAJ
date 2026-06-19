import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import {
  MutationType,
  MUTATION_TREE,
  MUTATION_DNA_NECTAR_COST_PER_LEVEL,
  UnitType,
} from '@a-raj/shared';
import type {
  MutationData,
  MutationTreeNode,
  MutationSynergy,
} from '@a-raj/shared';

/**
 * Mutation service — handles mutation research and the mutation tree.
 *
 * Research is instant for now (BullMQ deferred to a future sprint).
 * The service validates:
 *  - Mutation type exists
 *  - Prerequisites are met
 *  - Max level not exceeded
 *  - Sufficient DNA Nectar
 *
 * After research, checks for synergy unlocks (e.g. new unit types).
 */
@Injectable()
export class MutationService {
  private readonly logger = new Logger(MutationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
  ) {}

  /**
   * Get the full mutation tree annotated with the player's researched mutations.
   * Returns the tree nodes with a `researchedLevel` field (0 if not researched).
   */
  async getTree(userId: string): Promise<
    (MutationTreeNode & { researchedLevel: number; unlocksUnit?: UnitType })[]
  > {
    const mutations = await this.getPlayerMutations(userId);
    const mutationMap = new Map<MutationType, number>();
    for (const m of mutations) {
      mutationMap.set(m.mutationType, m.level);
    }

    // Compute which units are unlocked via synergy combos (used for per-node annotation)
    const unlockedUnits = new Set(this.getUnlockedUnits(mutations));

    return MUTATION_TREE.map((node) => {
      // Find any synergy on this node that unlocks a unit already in the unlocked set
      const synergyUnlock = node.synergies.find(
        (s) => s.unlocksUnit && unlockedUnits.has(s.unlocksUnit),
      );

      return {
        ...node,
        researchedLevel: mutationMap.get(node.type) ?? 0,
        unlocksUnit: synergyUnlock?.unlocksUnit,
      };
    });
  }

  /**
   * Get all mutations the player has researched.
   */
  private async getPlayerMutations(userId: string): Promise<MutationData[]> {
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { mutations: true },
    });

    if (!hive) {
      return [];
    }

    return hive.mutations.map((m) => ({
      id: m.id,
      mutationType: m.mutationType as MutationType,
      level: m.level,
    }));
  }

  /**
   * Research the next level of a mutation.
   *
   * @param userId - The authenticated user
   * @param mutationTypeStr - The mutation type string (validated against MutationType enum)
   * @returns The updated mutation and remaining resources
   */
  async researchMutation(
    userId: string,
    mutationTypeStr: string,
  ): Promise<{
    mutation: MutationData;
    resources: {
      biomass: number;
      water: number;
      heat: number;
      dnaNectar: number;
    };
    unlockedUnits: UnitType[];
  }> {
    // 1. Validate mutation type
    if (!Object.values(MutationType).includes(mutationTypeStr as MutationType)) {
      throw new BadRequestException(`Invalid mutation type: ${mutationTypeStr}`);
    }
    const mutationType = mutationTypeStr as MutationType;

    const node = MUTATION_TREE.find((n) => n.type === mutationType);
    if (!node) {
      throw new BadRequestException(`Unknown mutation: ${mutationType}`);
    }

    // 2. Get hive with current mutations
    let hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { mutations: true },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    const existing = hive.mutations.find(
      (m) => m.mutationType === mutationType,
    );
    const currentLevel = existing?.level ?? 0;
    const targetLevel = currentLevel + 1;

    // 3. Validate max level
    if (targetLevel > node.maxLevel) {
      throw new BadRequestException(
        `${node.name} max level ${node.maxLevel} reached`,
      );
    }

    // 4. Validate prerequisites
    this.validatePrerequisites(node, hive.mutations, targetLevel);

    // 5. Calculate cost
    const dnaNectarCost = targetLevel * MUTATION_DNA_NECTAR_COST_PER_LEVEL;

    // 6. Run lazy calculation, then validate resources
    await this.engineService.updateHiveState(hive.id, new Date());

    hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { mutations: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive vanished');
    }

    if (hive.dnaNectar < dnaNectarCost) {
      throw new BadRequestException(
        `Not enough DNA Nectar. Need ${dnaNectarCost}, have ${Math.floor(hive.dnaNectar)}`,
      );
    }

    // 7. Deduct DNA Nectar and create/update mutation in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct DNA Nectar
      const updatedHive = await tx.hive.update({
        where: { id: hive!.id },
        data: {
          dnaNectar: { decrement: dnaNectarCost },
        },
      });

      let mutation: { id: string; mutationType: string; level: number };

      if (existing) {
        // Upgrade
        mutation = await tx.mutation.update({
          where: { id: existing.id },
          data: { level: targetLevel },
        });
      } else {
        // New research
        mutation = await tx.mutation.create({
          data: {
            hiveId: hive!.id,
            mutationType,
            level: targetLevel,
          },
        });
      }

      return { mutation, resources: updatedHive };
    });

    // 8. After research, check which new units are unlocked
    const allMutations = [
      ...hive.mutations
        .filter((m) => m.mutationType !== mutationType)
        .map((m) => ({
          id: m.id,
          mutationType: m.mutationType as MutationType,
          level: m.level,
        })),
      {
        id: result.mutation.id,
        mutationType: result.mutation.mutationType as MutationType,
        level: targetLevel,
      },
    ];

    const unlockedUnits = this.getUnlockedUnits(allMutations);

    if (unlockedUnits.length > 0) {
      this.logger.log(
        `Mutation synergy unlocked: ${unlockedUnits.join(', ')} for user ${userId}`,
      );
    }

    this.logger.log(
      `${node.name} researched to level ${targetLevel} ` +
        `(cost: ${dnaNectarCost} DNA Nectar) by user ${userId}`,
    );

    return {
      mutation: {
        id: result.mutation.id,
        mutationType: result.mutation.mutationType as MutationType,
        level: result.mutation.level,
      },
      resources: {
        biomass: result.resources.biomass,
        water: result.resources.water,
        heat: result.resources.heat,
        dnaNectar: result.resources.dnaNectar,
      },
      unlockedUnits,
    };
  }

  /**
   * Validate that all prerequisites for a mutation are met.
   * A prerequisite is met if the player has researched that mutation
   * at or above the required level.
   */
  private validatePrerequisites(
    node: MutationTreeNode,
    playerMutations: Array<{ mutationType: string; level: number }>,
    targetLevel: number,
  ): void {
    if (node.prerequisites.length === 0) {
      return;
    }

    for (const prereq of node.prerequisites) {
      const playerMutation = playerMutations.find(
        (m) => m.mutationType === prereq.type,
      );

      if (!playerMutation || playerMutation.level < prereq.level) {
        const prereqNode = MUTATION_TREE.find((n) => n.type === prereq.type);
        throw new BadRequestException(
          `Prerequisite not met: ${prereqNode?.name ?? prereq.type} level ${prereq.level} required`,
        );
      }
    }
  }

  /**
   * Get units unlocked by synergy combinations from the player's mutations.
   * A synergy is active when ALL required mutations are at the required levels.
   */
  private getUnlockedUnits(mutations: MutationData[]): UnitType[] {
    const unlocked: UnitType[] = [];
    const levelMap = new Map<MutationType, number>();
    for (const m of mutations) {
      levelMap.set(m.mutationType, m.level);
    }

    for (const node of MUTATION_TREE) {
      for (const synergy of node.synergies) {
        if (this.isSynergyActive(synergy, levelMap)) {
          if (synergy.unlocksUnit && !unlocked.includes(synergy.unlocksUnit)) {
            unlocked.push(synergy.unlocksUnit);
          }
        }
      }
    }

    return unlocked;
  }

  /**
   * Check if a synergy is active given the player's mutation levels.
   */
  private isSynergyActive(
    synergy: MutationSynergy,
    levelMap: Map<MutationType, number>,
  ): boolean {
    if (synergy.required.length === 0) {
      return false;
    }

    for (const req of synergy.required) {
      const playerLevel = levelMap.get(req.type) ?? 0;
      if (playerLevel < req.level) {
        return false;
      }
    }

    return true;
  }

}
