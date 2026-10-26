const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatNum(value: number, digits: number): string {
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toFixed(digits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = digits > 0 ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${body}` : body;
}

export function formatAf(value: number, digits = 2): string {
  return `${formatNum(value, digits)} AF`;
}

export function formatUsd(value: number): string {
  const negative = value < 0;
  return `${negative ? "-" : ""}$${formatNum(Math.abs(value), 2)}`;
}

export function formatKwh(value: number): string {
  return `${formatNum(value, 0)} kWh`;
}

export function formatPct(fraction: number): string {
  return `${formatNum(fraction * 100, 1)}%`;
}

export function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTH_LONG[month - 1]} ${day}, ${year}`;
}

export function formatMonth(periodStart: string): string {
  const [year, month] = periodStart.split("-").map(Number);
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

export function formatMonthShort(periodStart: string): string {
  return MONTH_SHORT[Number(periodStart.slice(5, 7)) - 1];
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
