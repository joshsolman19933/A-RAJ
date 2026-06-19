import { api } from './auth.service';
import type { MapHexData } from '@a-raj/shared';

export const mapService = {
  async getViewport(
    qMin: number,
    qMax: number,
    rMin: number,
    rMax: number,
  ): Promise<MapHexData[]> {
    const { data } = await api.get<MapHexData[]>('/map/viewport', {
      params: { qMin, qMax, rMin, rMax },
    });
    return data;
  },
};
