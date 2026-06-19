import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EngineService } from '../engine/engine.service.js';
import {
  UnitType,
  UNIT_STATS,
  AttackType,
  ChamberType,
  CHAMBER_DEFINITIONS,
  RAID_LOOT_CAPACITY_FACTOR,
} from '@a-raj/shared';
import type { UnitBatchBrief, CombatReport } from '@a-raj/shared';

// --- PvE Nest Presets ---
const PVE_NEST_PRESET = {
  attackPhysical: 50,
  attackAcid: 20,
  defensePhysical: 40,
  defenseAcid: 15,
  resources: { biomass: 200, water: 100, dnaNectar: 10 },
};

/**
 * Combat service — resolves combat between attacker and defender.
 *
 * Combat is resolved instantly (BullMQ deferred).
 * Uses a power-ratio formula:
 *   attackerPower = sum(count × (attackPhysical + attackAcid))
 *   defenderPower = sum(count × (defensePhysical + defenseAcid)) + chamber defense bonus
 *   totalCombat = attackerPower + defenderPower
 *   attackerCasualtyRate = defenderPower / totalCombat
 *   defenderCasualtyRate = attackerPower / totalCombat
 */
@Injectable()
export class CombatService {
  private readonly logger = new Logger(CombatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
  ) {}

  /**
   * Resolve combat between an attacking army and a defending hive/PvE nest.
   * Everything runs inside a single $transaction for atomicity.
   *
   * @param movementId - The Movement record ID (deleted after resolution)
   * @param attackerHiveId - The attacking hive
   * @param attackType - RAID or SIEGE
   * @param targetQ - Target hex Q
   * @param targetR - Target hex R
   * @param units - The unit types and counts to commit to battle
   */
  async resolveCombat(params: {
    movementId: string;
    attackerHiveId: string;
    attackType: AttackType;
    targetQ: number;
    targetR: number;
    units: UnitBatchBrief[];
  }): Promise<CombatReport> {
    const { movementId, attackerHiveId, attackType, targetQ, targetR, units } =
      params;

    // Validate units
    if (!units.length) {
      throw new Error('No units sent to combat');
    }

    // Bring both attacker and defender up to date
    await this.engineService.updateHiveState(attackerHiveId);

    // Find the target hex
    const targetHex = await this.prisma.mapHex.findUnique({
      where: { q_r: { q: targetQ, r: targetR } },
    });

    if (!targetHex) {
      throw new Error(`No hex at (${targetQ}, ${targetR})`);
    }

    if (targetHex.type !== 'HIVE' && targetHex.type !== 'PVE_NEST') {
      throw new Error(`Target is not attackable (type: ${targetHex.type})`);
    }

    if (
      targetHex.type === 'HIVE' &&
      targetHex.hiveId === attackerHiveId
    ) {
      throw new Error('Cannot attack your own hive');
    }

    // Compute attacker power
    const attackerPower = this.computePower(units, 'attack');
    let defenderPower: number;
    let defenderUnits: UnitBatchBrief[] = [];
    let defenderHiveId: string | undefined;
    let defenderBiomass = 0;
    let defenderWater = 0;
    let defenderDnaNectar = 0;
    let defenderChambers: Array<{ type: string; level: number }> = [];

    if (targetHex.type === 'HIVE' && targetHex.hiveId) {
      await this.engineService.updateHiveState(targetHex.hiveId);

      const defHive = await this.prisma.hive.findUnique({
        where: { id: targetHex.hiveId },
        include: { unitBatches: true, chambers: true },
      });

      if (!defHive) {
        throw new Error('Defender hive not found');
      }

      defenderUnits = defHive.unitBatches.map((b) => ({
        unitType: b.unitType as UnitType,
        count: b.count,
      }));

      defenderPower = this.computePower(defenderUnits, 'defend');

      // Add chamber defense bonus (Acid Gland)
      const acidGland = defHive.chambers.find(
        (c) => c.type === ChamberType.ACID_GLAND,
      );
      if (acidGland) {
        const chamberDef = CHAMBER_DEFINITIONS[ChamberType.ACID_GLAND];
        const bonus = (chamberDef?.defensePerLevel ?? 50) * acidGland.level;
        defenderPower += bonus;
        this.logger.debug(
          `Acid Gland lv${acidGland.level} adds ${bonus} defense`,
        );
      }

      defenderHiveId = defHive.id;
      defenderBiomass = defHive.biomass;
      defenderWater = defHive.water;
      defenderDnaNectar = defHive.dnaNectar;
      defenderChambers = defHive.chambers.map((c) => ({
        type: c.type,
        level: c.level,
      }));
    } else {
      // PvE nest defender — use preset stats
      defenderPower =
        PVE_NEST_PRESET.defensePhysical + PVE_NEST_PRESET.defenseAcid;
      defenderBiomass = PVE_NEST_PRESET.resources.biomass;
      defenderWater = PVE_NEST_PRESET.resources.water;
      defenderDnaNectar = PVE_NEST_PRESET.resources.dnaNectar;
    }

    // Calculate casualty rates
    const totalCombat = attackerPower + defenderPower;
    if (totalCombat <= 0) {
      throw new Error('Zero combat power — check unit stats');
    }

    const attackerCasualtyRate = Math.min(1, defenderPower / totalCombat);
    const defenderCasualtyRate = Math.min(1, attackerPower / totalCombat);
    const attackerWins = attackerPower >= defenderPower;

    // Compute losses
    const attackerLosses: UnitBatchBrief[] = units.map((u) => ({
      unitType: u.unitType,
      count: Math.ceil(u.count * attackerCasualtyRate),
    }));

    const defenderLosses: UnitBatchBrief[] = defenderUnits.map((u) => ({
      unitType: u.unitType,
      count: Math.ceil(u.count * defenderCasualtyRate),
    }));

    let resourcesLooted:
      | { biomass: number; water: number; dnaNectar?: number }
      | undefined;
    let chambersDestroyed: ChamberType[] | undefined;

    // --- Execute everything in a single $transaction ---
    await this.prisma.$transaction(async (tx) => {
      // 1. Deduct attacker casualties directly from unit batches
      for (const loss of attackerLosses) {
        if (loss.count <= 0) continue;
        let remaining = loss.count;

        const batches = await tx.unitBatch.findMany({
          where: { hiveId: attackerHiveId, unitType: loss.unitType },
          orderBy: { hatchedAt: 'asc' },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          const taken = Math.min(batch.count, remaining);
          const leftover = batch.count - taken;
          remaining -= taken;

          if (leftover <= 0) {
            await tx.unitBatch.delete({ where: { id: batch.id } });
          } else {
            await tx.unitBatch.update({
              where: { id: batch.id },
              data: { count: leftover },
            });
          }
        }
      }

      // 2. Deduct defender casualties (for both RAID and SIEGE, if it's a hive)
      if (defenderHiveId) {
        for (const loss of defenderLosses) {
          if (loss.count <= 0) continue;
          let remaining = loss.count;

          const batches = await tx.unitBatch.findMany({
            where: { hiveId: defenderHiveId, unitType: loss.unitType },
            orderBy: { hatchedAt: 'asc' },
          });

          for (const batch of batches) {
            if (remaining <= 0) break;
            const taken = Math.min(batch.count, remaining);
            const leftover = batch.count - taken;
            remaining -= taken;

            if (leftover <= 0) {
              await tx.unitBatch.delete({ where: { id: batch.id } });
            } else {
              await tx.unitBatch.update({
                where: { id: batch.id },
                data: { count: leftover },
              });
            }
          }
        }
      }

      // 3. Handle post-combat effects based on attack type and result
      if (attackerWins) {
        if (attackType === AttackType.RAID) {
          // Steal resources based on carrying capacity
          const carryingCapacity =
            this.computeCarryingCapacity(units) * RAID_LOOT_CAPACITY_FACTOR;
          const lootBiomass = Math.min(defenderBiomass, carryingCapacity * 0.6);
          const lootWater = Math.min(defenderWater, carryingCapacity * 0.3);
          const lootDna = Math.min(
            defenderDnaNectar,
            carryingCapacity * 0.1,
          );

          resourcesLooted = {
            biomass: Math.floor(lootBiomass),
            water: Math.floor(lootWater),
            dnaNectar: Math.floor(lootDna),
          };

          // Add loot to attacker
          await tx.hive.update({
            where: { id: attackerHiveId },
            data: {
              biomass: { increment: resourcesLooted.biomass },
              water: { increment: resourcesLooted.water },
              dnaNectar: { increment: resourcesLooted.dnaNectar ?? 0 },
            },
          });

          // Deduct from defender (player hives only; PvE nests have infinite resources)
          if (defenderHiveId) {
            await tx.hive.update({
              where: { id: defenderHiveId },
              data: {
                biomass: { decrement: resourcesLooted.biomass },
                water: { decrement: resourcesLooted.water },
                dnaNectar: { decrement: resourcesLooted.dnaNectar ?? 0 },
              },
            });
          }
        } else if (attackType === AttackType.SIEGE) {
          // Destroy chambers (player hives only)
          if (defenderHiveId) {
            const targetChambers = defenderChambers.filter(
              (c) => c.type !== ChamberType.QUEEN,
            );

            if (targetChambers.length > 0) {
              const destroyCount = Math.min(2, targetChambers.length);
              const shuffled = [...targetChambers]
                .sort(() => Math.random() - 0.5)
                .slice(0, destroyCount);

              chambersDestroyed = shuffled.map(
                (c) => c.type as ChamberType,
              );

              for (const ch of shuffled) {
                const existing = await tx.chamber.findFirst({
                  where: { hiveId: defenderHiveId, type: ch.type },
                });
                if (!existing) continue;

                if (existing.level <= 1) {
                  await tx.chamber.delete({
                    where: { id: existing.id },
                  });
                } else {
                  await tx.chamber.update({
                    where: { id: existing.id },
                    data: { level: { decrement: 1 } },
                  });
                }
              }
            }
          }
        }
      }

      // 4. Delete the movement record (combat resolved)
      await tx.movement.delete({ where: { id: movementId } });
    });

    const report: CombatReport = {
      id: `report_${movementId}`,
      attackerId: attackerHiveId,
      defenderId: defenderHiveId ?? `pve_${targetQ}_${targetR}`,
      attackerLosses,
      defenderLosses,
      resourcesLooted,
      chambersDestroyed,
      resolvedAt: new Date().toISOString(),
      isVictory: attackerWins,
    };

    this.logger.log(
      `Combat resolved [${movementId}]: ${attackerWins ? 'VICTORY' : 'DEFEAT'} | ` +
        `${attackType} from ${attackerHiveId} → (${targetQ},${targetR}) | ` +
        `power ${attackerPower.toFixed(0)} vs ${defenderPower.toFixed(0)} | ` +
        `attackerLossRt ${(attackerCasualtyRate * 100).toFixed(0)}% | ` +
        `defenderLossRt ${(defenderCasualtyRate * 100).toFixed(0)}%`,
    );

    return report;
  }

  // --- Private helpers ---

  private computePower(
    units: UnitBatchBrief[],
    mode: 'attack' | 'defend',
  ): number {
    return units.reduce((total, u) => {
      const stats = UNIT_STATS[u.unitType];
      if (!stats) return total;
      if (mode === 'attack') {
        return total + (stats.attackPhysical + stats.attackAcid) * u.count;
      }
      return total + (stats.defensePhysical + stats.defenseAcid) * u.count;
    }, 0);
  }

  private computeCarryingCapacity(units: UnitBatchBrief[]): number {
    return units.reduce((total, u) => {
      const stats = UNIT_STATS[u.unitType];
      if (!stats) return total;
      return total + stats.carryingCapacity * u.count;
    }, 0);
  }
}
