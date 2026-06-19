import { api } from './auth.service';
import type { MutationData, MutationTreeNode } from '@a-raj/shared';
import { UnitType } from '@a-raj/shared';

export interface ResearchResponse {
  mutation: MutationData;
  resources: {
    biomass: number;
    water: number;
    heat: number;
    dnaNectar: number;
  };
  unlockedUnits: UnitType[];
}

export type TreeResponse = (MutationTreeNode & {
  researchedLevel: number;
  unlocksUnit?: UnitType;
})[];

export const mutationService = {
  async getTree(): Promise<TreeResponse> {
    const { data } = await api.get<TreeResponse>('/mutation/tree');
    return data;
  },

  async research(mutationType: string): Promise<ResearchResponse> {
    const { data } = await api.post<ResearchResponse>('/mutation/research', {
      mutationType,
    });
    return data;
  },
};
