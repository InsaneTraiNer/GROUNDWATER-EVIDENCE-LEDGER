import { KWH_PER_AF_FOOT, KW_PER_HP, WATER_HP_DIVISOR } from "@/lib/ledger/catalog";

export type PlantInput = {
  gpm: number;
  tdhFt: number;
  inputKw: number;
};

export type PlantResult = {
  waterHp: number;
  inputHp: number;
  ope: number;
  kwhPerAf: number;
  valid: boolean;
};

export function plantFrom(input: PlantInput): PlantResult {
  const waterHp = (input.gpm * input.tdhFt) / WATER_HP_DIVISOR;
  const inputHp = input.inputKw / KW_PER_HP;
  const ope = inputHp === 0 ? Number.NaN : waterHp / inputHp;
  const kwhPerAf = ope > 0 ? (KWH_PER_AF_FOOT * input.tdhFt) / ope : Number.NaN;
  const valid =
    input.gpm > 0 &&
    input.tdhFt > 0 &&
    input.inputKw > 0 &&
    Number.isFinite(ope) &&
    ope > 0 &&
    Number.isFinite(kwhPerAf) &&
    kwhPerAf > 0;
  return { waterHp, inputHp, ope, kwhPerAf, valid };
}

export function combineRelative(kwhRelative: number, opeRelative: number): number {
  return Math.sqrt(kwhRelative ** 2 + opeRelative ** 2);
}
