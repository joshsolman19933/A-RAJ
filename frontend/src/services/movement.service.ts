import { api } from './auth.service';
import type { MovementData, UnitBatchBrief, CombatReport } from '@a-raj/shared';

export interface SendMovementRequest {
  attackType: string;
  targetQ: number;
  targetR: number;
  units: UnitBatchBrief[];
}

export interface SendMovementResponse {
  movement: MovementData;
  combatReport: CombatReport;
}

export const movementService = {
  async getActive(): Promise<MovementData[]> {
    const { data } = await api.get<MovementData[]>('/movement/active');
    return data;
  },

  async send(payload: SendMovementRequest): Promise<SendMovementResponse> {
    const { data } = await api.post<SendMovementResponse>(
      '/movement/send',
      payload,
    );
    return data;
  },
};
