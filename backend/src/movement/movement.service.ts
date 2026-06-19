import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import { CombatService } from '../combat/combat.service.js';
import {
  UnitType,
  UNIT_STATS,
  AttackType,
  calculateTravelTime,
} from '@a-raj/shared';
import type { MovementData, UnitBatchBrief, CombatReport } from '@a-raj/shared';

/**
 * Movement service — handles army movement and attack dispatch.
 *
 * Combat resolves instantly for now (BullMQ deferred).
 * All unit manipulation happens inside CombatService.resolveCombat()'s $transaction.
 */
@Injectable()
export class MovementService {
  private readonly logger = new Logger(MovementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
    private readonly combatService: CombatService,
  ) {}

  /**
   * Get all active (not yet resolved) movements for the user's hive.
   */
  async getActiveMovements(userId: string): Promise<MovementData[]> {
    const hive = await this.prisma.hive.findFirst({
      where: { userId },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    await this.engineService.updateHiveState(hive.id);

    const movements = await this.prisma.movement.findMany({
      where: { fromHiveId: hive.id },
      orderBy: { sentAt: 'desc' },
    });

    return movements.map((m) => ({
      id: m.id,
      attackType: m.attackType as AttackType,
      fromHiveId: m.fromHiveId,
      targetQ: m.targetQ,
      targetR: m.targetR,
      units: m.units as unknown as UnitBatchBrief[],
      sentAt: m.sentAt.toISOString(),
      arriveAt: m.arriveAt.toISOString(),
    }));
  }

  /**
   * Send units to attack a target hex.
   * Validates target, units, and resources. Combat resolves instantly.
   */
  async sendMovement(
    userId: string,
    attackTypeStr: string,
    targetQ: number,
    targetR: number,
    unitSelections: UnitBatchBrief[],
  ): Promise<{ movement: MovementData; combatReport: CombatReport }> {
    // 1. Validate attack type
    if (!Object.values(AttackType).includes(attackTypeStr as AttackType)) {
      throw new BadRequestException(`Invalid attack type: ${attackTypeStr}`);
    }
    const attackType = attackTypeStr as AttackType;

    // 2. Get the player's hive
    let hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { unitBatches: true },
    });

    if (!hive) {
      throw new NotFoundException('No hive found');
    }

    // 3. Run lazy calculation
    await this.engineService.updateHiveState(hive.id);

    // Re-fetch with fresh unit batches
    hive = await this.prisma.hive.findFirst({
      where: { userId },
      include: { unitBatches: true },
    });

    if (!hive) {
      throw new NotFoundException('Hive vanished');
    }

    // 4. Validate target hex exists and is attackable
    const targetHex = await this.prisma.mapHex.findUnique({
      where: { q_r: { q: targetQ, r: targetR } },
    });

    if (!targetHex) {
      throw new BadRequestException(
        `No hex at (${targetQ}, ${targetR})`,
      );
    }

    if (targetHex.type !== 'HIVE' && targetHex.type !== 'PVE_NEST') {
      throw new BadRequestException(
        `Cannot attack ${targetHex.type}. Only HIVE and PVE_NEST are valid targets.`,
      );
    }

    if (targetHex.type === 'HIVE' && targetHex.hiveId === hive.id) {
      throw new BadRequestException('Cannot attack your own hive');
    }

    // 5. Validate unit selections
    if (!unitSelections.length) {
      throw new BadRequestException('Must send at least one unit');
    }

    const unitMap = new Map<string, number>();
    for (const batch of hive.unitBatches) {
      unitMap.set(
        batch.unitType,
        (unitMap.get(batch.unitType) ?? 0) + batch.count,
      );
    }

    for (const sel of unitSelections) {
      if (!Object.values(UnitType).includes(sel.unitType)) {
        throw new BadRequestException(`Invalid unit type: ${sel.unitType}`);
      }
      if (sel.unitType === UnitType.QUEEN) {
        throw new BadRequestException(
          'Queen units cannot be sent to attack',
        );
      }
      if (sel.count <= 0 || !Number.isInteger(sel.count)) {
        throw new BadRequestException(
          `Count must be a positive integer for ${sel.unitType}`,
        );
      }
      const available = unitMap.get(sel.unitType) ?? 0;
      if (sel.count > available) {
        throw new BadRequestException(
          `Not enough ${sel.unitType}. Requested ${sel.count}, have ${available}`,
        );
      }
    }

    // 6. Calculate travel time
    const speeds = unitSelections.map((sel) => {
      const stats = UNIT_STATS[sel.unitType];
      return stats?.speed ?? Infinity;
    });
    const slowestSpeed = Math.min(...speeds);

    if (slowestSpeed <= 0) {
      throw new BadRequestException('Invalid unit speed');
    }

    const travelHours = calculateTravelTime(
      { q: hive.q, r: hive.r },
      { q: targetQ, r: targetR },
      slowestSpeed,
    );

    if (!isFinite(travelHours) || travelHours <= 0) {
      throw new BadRequestException('Invalid travel time');
    }

    // 7. Create movement record (log only — combat handles all unit state)
    const now = new Date();
    const arriveAt = new Date(now.getTime() + travelHours * 3600 * 1000);

    const movement = await this.prisma.movement.create({
      data: {
        fromHiveId: hive.id,
        attackType,
        targetQ,
        targetR,
        sentAt: now,
        arriveAt,
        units: unitSelections as unknown as object[],
      },
    });

    const totalUnitCount = unitSelections.reduce((s, u) => s + u.count, 0);

    this.logger.log(
      `Movement created [${movement.id}]: ${attackType} from ${hive.id} → (${targetQ},${targetR}) | ` +
        `${unitSelections.length} unit types, ${totalUnitCount} total units | ` +
        `travel: ${travelHours.toFixed(1)}h at speed ${slowestSpeed}`,
    );

    // 8. Resolve combat instantly (all unit manipulation happens here in one $transaction)
    const combatReport = await this.combatService.resolveCombat({
      movementId: movement.id,
      attackerHiveId: hive.id,
      attackType,
      targetQ,
      targetR,
      units: unitSelections,
    });

    const movementData: MovementData = {
      id: movement.id,
      attackType: movement.attackType as AttackType,
      fromHiveId: movement.fromHiveId,
      targetQ: movement.targetQ,
      targetR: movement.targetR,
      units: movement.units as unknown as UnitBatchBrief[],
      sentAt: movement.sentAt.toISOString(),
      arriveAt: movement.arriveAt.toISOString(),
    };

    return { movement: movementData, combatReport };
  }
}
