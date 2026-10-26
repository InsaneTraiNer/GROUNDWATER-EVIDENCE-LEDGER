export const DEMO_TODAY = "2026-10-12";

export const KWH_PER_AF_FOOT = 1.024;
export const WATER_HP_DIVISOR = 3960;
export const KW_PER_HP = 0.746;
export const METER_UNCERTAINTY = 0.01;
export const OPE_UNCERTAINTY_FRESH = 0.04;
export const OPE_UNCERTAINTY_STALE = 0.08;
export const BASELINE_UNCERTAINTY = 0.15;
export const VOLUME_BENCHMARK = 0.05;

export type Identity = {
  ranchName: string;
  block: string;
  operator: string;
  county: string;
  apn: string;
  crop: string;
  acres: number;
  utility: string;
  account: string;
};

export type Well = {
  id: string;
  name: string;
  meterId: string;
  serviceId: string;
  dedicated: boolean;
  horsepower: number;
  role: string;
};

export const DEFAULT_IDENTITY: Identity = {
  ranchName: "Rios Ranch",
  block: "West Block",
  operator: "Elena Rios",
  county: "Madera County",
  apn: "033-180-014",
  crop: "Almonds",
  acres: 268,
  utility: "PG&E",
  account: "8472291564",
};

export const WELLS: Well[] = [
  {
    id: "well-4",
    name: "Well 4",
    meterId: "100892341",
    serviceId: "8472291564-1",
    dedicated: true,
    horsepower: 150,
    role: "Primary irrigation well",
  },
  {
    id: "well-7",
    name: "Well 7",
    meterId: "100892358",
    serviceId: "8472291564-2",
    dedicated: true,
    horsepower: 100,
    role: "Irrigation well",
  },
  {
    id: "well-2",
    name: "Well 2",
    meterId: "100892366",
    serviceId: "8472291564-3",
    dedicated: false,
    horsepower: 30,
    role: "Irrigation well on the headquarters service",
  },
];

export function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const days = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

export type Period = {
  start: string;
  end: string;
  days: number;
  month: number;
  year: number;
};

export function periodsFor(waterYear: string): Period[] {
  const endYear = Number(waterYear);
  const months: [number, number][] = [
    [10, endYear - 1],
    [11, endYear - 1],
    [12, endYear - 1],
    [1, endYear],
    [2, endYear],
    [3, endYear],
    [4, endYear],
    [5, endYear],
    [6, endYear],
    [7, endYear],
    [8, endYear],
    [9, endYear],
  ];
  return months.map(([month, year]) => {
    const days = daysInMonth(year, month);
    const mm = String(month).padStart(2, "0");
    const dd = String(days).padStart(2, "0");
    return {
      start: `${year}-${mm}-01`,
      end: `${year}-${mm}-${dd}`,
      days,
      month,
      year,
    };
  });
}

export function waterYearOf(periodStart: string): string {
  const [year, month] = periodStart.split("-").map(Number);
  return String(month >= 10 ? year + 1 : year);
}

export function yearStart(waterYear: string): string {
  return `${Number(waterYear) - 1}-10-01`;
}

export function yearEnd(waterYear: string): string {
  return `${waterYear}-09-30`;
}

export function wellByMeter(meterId: string): Well | undefined {
  return WELLS.find((well) => well.meterId === meterId);
}

export function wellById(wellId: string): Well | undefined {
  return WELLS.find((well) => well.id === wellId);
}
