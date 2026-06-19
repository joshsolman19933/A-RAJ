import { api } from './auth.service';
import type { HiveData, HiveBrief } from '@a-raj/shared';

export interface UpgradeChamberResponse {
  chamber: {
    id: string;
    type: string;
    level: number;
  };
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
}

export const hiveService = {
  async getHive(hiveId?: string): Promise<HiveData> {
    const { data } = await api.get<HiveData>('/hive', {
      params: hiveId ? { hiveId } : undefined,
    });
    return data;
  },

  async getAllHives(): Promise<HiveBrief[]> {
    const { data } = await api.get<HiveBrief[]>('/hive/list');
    return data;
  },

  async upgradeChamber(chamberType: string): Promise<UpgradeChamberResponse> {
    const { data } = await api.post<UpgradeChamberResponse>('/hive/upgrade', {
      chamberType,
    });
    return data;
  },
};
