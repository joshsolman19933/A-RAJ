import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HexType } from '@a-raj/shared';
import type { MapHexData } from '@a-raj/shared';

/**
 * Map service — handles map hex queries.
 */
@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all map hexes within a viewport bounding box.
   * Also includes hive information for HIVE-type hexes.
   */
  async getViewport(
    qMin: number,
    qMax: number,
    rMin: number,
    rMax: number,
  ): Promise<MapHexData[]> {
    const hexes = await this.prisma.mapHex.findMany({
      where: {
        q: { gte: qMin, lte: qMax },
        r: { gte: rMin, lte: rMax },
      },
      include: {
        hive: {
          select: {
            id: true,
            user: { select: { username: true } },
          },
        },
      },
    });

    return hexes.map((hex) => ({
      q: hex.q,
      r: hex.r,
      // Normalize orphaned HIVE hexes (hive deleted but type not updated)
      type: (
        hex.type === HexType.HIVE && !hex.hiveId ? HexType.EMPTY : hex.type
      ) as HexType,
      hiveId: hex.hiveId ?? undefined,
      hiveName: hex.hive?.user.username ?? undefined,
      // clanColorHex will be added in Phase 4 when clans are implemented
      clanColorHex: undefined,
    }));
  }
}
