import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { PveNestTier, PVE_NEST_TIERS } from '@a-raj/shared';
import type { PveNestData, PveNestTierConfig } from '@a-raj/shared';

export const PVE_RESPAWN_QUEUE = 'pve-respawn';

/**
 * PvE Service — manages PvE nest lifecycle: spawning, tier resolution,
 * post-defeat respawn scheduling via BullMQ.
 */
@Injectable()
export class PveService {
  private readonly logger = new Logger(PveService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PVE_RESPAWN_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Get PvE nests in a bounding box viewport.
   */
  async getNests(
    qMin: number,
    qMax: number,
    rMin: number,
    rMax: number,
  ): Promise<PveNestData[]> {
    const nests = await this.prisma.pveNest.findMany({
      where: {
        q: { gte: qMin, lte: qMax },
        r: { gte: rMin, lte: rMax },
      },
    });

    return nests.map((n) => ({
      id: n.id,
      q: n.q,
      r: n.r,
      tier: n.tier as PveNestTier,
      defeatedAt: n.defeatedAt?.toISOString() ?? null,
      respawnAt: n.respawnAt?.toISOString() ?? null,
    }));
  }

  /**
   * Get nest tier config for combat stat resolution.
   * Called by CombatService when resolving PvE combat.
   * Returns null if the nest is defeated (not available to attack).
   * Read-only — no DB side effects.
   */
  async getNestTierConfig(
    q: number,
    r: number,
  ): Promise<{ tier: PveNestTier; config: PveNestTierConfig } | null> {
    const nest = await this.prisma.pveNest.findUnique({
      where: { q_r: { q, r } },
    });

    if (!nest) {
      // Fallback for legacy nests without PveNest records (pre-migration)
      return {
        tier: PveNestTier.EASY,
        config: PVE_NEST_TIERS[PveNestTier.EASY],
      };
    }

    // Nest is defeated and respawn hasn't happened yet — not attackable
    const now = new Date();
    if (nest.defeatedAt && nest.respawnAt && nest.respawnAt > now) {
      return null;
    }

    // Nest is alive (either never defeated, or respawn time has passed)
    const tier = nest.tier as PveNestTier;
    return { tier, config: PVE_NEST_TIERS[tier] };
  }

  /**
   * Mark a PvE nest as defeated and schedule respawn.
   * Called after successful PvE combat resolution.
   */
  async markDefeated(q: number, r: number): Promise<void> {
    const nest = await this.prisma.pveNest.findUnique({
      where: { q_r: { q, r } },
    });

    if (!nest) {
      this.logger.warn(`No PveNest record at (${q}, ${r})`);
      return;
    }

    const tier = nest.tier as PveNestTier;
    const config = PVE_NEST_TIERS[tier];
    const now = new Date();
    const respawnAt = new Date(
      now.getTime() + config.respawnHours * 3600 * 1000,
    );

    // Update nest state and schedule respawn job
    await this.prisma.pveNest.update({
      where: { id: nest.id },
      data: { defeatedAt: now, respawnAt },
    });

    const delayMs = respawnAt.getTime() - now.getTime();
    const job = await this.queue.add(
      'respawn-pve-nest',
      { nestId: nest.id, q, r },
      {
        delay: delayMs,
        jobId: `pve-respawn-${nest.id}`,
        removeOnComplete: true,
      },
    );

    if (job.id) {
      await this.prisma.pveNest.update({
        where: { id: nest.id },
        data: { jobId: job.id },
      });
    }

    this.logger.log(
      `PvE nest (${q},${r}) [${tier}] defeated — respawn in ${config.respawnHours}h`,
    );
  }

  /**
   * Respawn a PvE nest: clear defeated state.
   * Called by the BullMQ processor.
   */
  async respawnNest(nestId: string): Promise<void> {
    const nest = await this.prisma.pveNest.findUnique({
      where: { id: nestId },
    });

    if (!nest) {
      this.logger.error(`PveNest ${nestId} not found for respawn`);
      return;
    }

    await this.prisma.pveNest.update({
      where: { id: nestId },
      data: { defeatedAt: null, respawnAt: null, jobId: null },
    });

    // Also update MapHex back to PVE_NEST if it was cleared
    await this.prisma.mapHex.updateMany({
      where: { q: nest.q, r: nest.r, type: 'EMPTY' },
      data: { type: 'PVE_NEST' },
    });

    this.logger.log(`PvE nest (${nest.q},${nest.r}) respawned — ready to attack`);
  }
}
