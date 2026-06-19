import { api } from './auth.service';
import type { UnitBatchData } from '@a-raj/shared';

export interface HatchResponse {
  batch: UnitBatchData;
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
}

export const militaryService = {
  async getUnits(): Promise<UnitBatchData[]> {
    const { data } = await api.get<UnitBatchData[]>('/military/units');
    return data;
  },

  async hatch(unitType: string, count: number): Promise<HatchResponse> {
    const { data } = await api.post<HatchResponse>('/military/hatch', {
      unitType,
      count,
    });
    return data;
  },
};
