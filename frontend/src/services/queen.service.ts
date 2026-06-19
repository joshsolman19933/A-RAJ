import { api } from './auth.service';
import type {
  QueenTrainingData,
  MovementData,
} from '@a-raj/shared';
import type { UnitType } from '@a-raj/shared';

export interface SwarmDto {
  targetQ: number;
  targetR: number;
  escortUnits: Array<{ unitType: UnitType; count: number }>;
}

export interface SwarmResponse {
  movement: MovementData;
  swarmId: string;
}

export const queenService = {
  /** Start training a new Queen */
  async trainQueen(): Promise<QueenTrainingData> {
    const { data } = await api.post<QueenTrainingData>('/queen/train');
    return data;
  },

  /** Get current Queen training status */
  async getQueenStatus(): Promise<{ status: QueenTrainingData | null }> {
    const { data } = await api.get<{ status: QueenTrainingData | null }>('/queen/status');
    return data;
  },

  /** Launch a swarm to a target hex */
  async launchSwarm(dto: SwarmDto): Promise<SwarmResponse> {
    const { data } = await api.post<SwarmResponse>('/queen/swarm', dto);
    return data;
  },

  /** Get active swarm movements */
  async getSwarmStatus(): Promise<{ movements: MovementData[] }> {
    const { data } = await api.get<{ movements: MovementData[] }>('/queen/swarm/status');
    return data;
  },
};
