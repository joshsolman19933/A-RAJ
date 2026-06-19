import { api } from './auth.service';
import type { HiveData } from '@a-raj/shared';

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
  async getHive(): Promise<HiveData> {
    const { data } = await api.get<HiveData>('/hive');
    return data;
  },

  async upgradeChamber(chamberType: string): Promise<UpgradeChamberResponse> {
    const { data } = await api.post<UpgradeChamberResponse>('/hive/upgrade', {
      chamberType,
    });
    return data;
  },
};
