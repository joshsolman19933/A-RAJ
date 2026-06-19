import { UnitType } from '@a-raj/shared';

export function getUnitName(type: string): string {
  const map: Record<string, string> = {
    [UnitType.WORKER]: '🐜 Dolgozó',
    [UnitType.BLOOD_TANK]: '🛡️ Vér-Páncélos',
    [UnitType.ACID_SPITTER]: '🧪 Sav-Köpő',
    [UnitType.SCOUT_WASP]: '🐝 Fürkészdarázs',
    [UnitType.QUEEN]: '👑 Királynő',
  };
  return map[type] ?? type;
}

export function getUnitNameShort(type: string): string {
  const map: Record<string, string> = {
    [UnitType.WORKER]: 'Dolgozó',
    [UnitType.BLOOD_TANK]: 'Vér-Páncélos',
    [UnitType.ACID_SPITTER]: 'Sav-Köpő',
    [UnitType.SCOUT_WASP]: 'Fürkészdarázs',
    [UnitType.QUEEN]: 'Királynő',
  };
  return map[type] ?? type;
}
