import { daysInMonth, waterYearOf, WELLS, type Well } from "@/lib/ledger/catalog";
import type { ImportedRow } from "@/lib/ledger/events";

export const CSV_HEADER = "meter_id,period_start,period_end,kwh,quality";

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return null;
  return { year, month, day };
}

function parseGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

export function parseMeterCsv(text: string): { ok: true; rows: ImportedRow[] } | { ok: false; error: string } {
  const grid = parseGrid(text.trim());
  if (grid.length < 2) return { ok: false, error: "Add a header row and at least one read." };
  const header = grid[0].map((value) => value.trim().toLowerCase());
  const indexOf = (name: string) => header.indexOf(name);
  const meterCol = indexOf("meter_id");
  const startCol = indexOf("period_start");
  const endCol = indexOf("period_end");
  const kwhCol = indexOf("kwh");
  const qualityCol = indexOf("quality");
  if (meterCol < 0 || startCol < 0 || endCol < 0 || kwhCol < 0) {
    return { ok: false, error: `Header must include ${CSV_HEADER}.` };
  }

  const known = new Map<string, Well>(WELLS.map((well) => [well.meterId, well]));
  const rows: ImportedRow[] = [];
  const seen = new Set<string>();

  for (let line = 1; line < grid.length; line += 1) {
    const values = grid[line];
    const where = `Row ${line + 1}`;
    const meterId = (values[meterCol] ?? "").trim();
    const well = known.get(meterId);
    if (!well) {
      return {
        ok: false,
        error: `${where}: meter ${meterId || "(blank)"} is not on this record. Use ${WELLS.map((item) => item.meterId).join(", ")}.`,
      };
    }
    const start = parseDate(values[startCol] ?? "");
    const end = parseDate(values[endCol] ?? "");
    if (!start || !end) return { ok: false, error: `${where}: dates must be YYYY-MM-DD.` };
    if (start.year !== end.year || start.month !== end.month) {
      return { ok: false, error: `${where}: a row has to stay inside one calendar month.` };
    }
    if (end.day < start.day) return { ok: false, error: `${where}: the end date is before the start.` };
    const waterYear = Number(waterYearOf(`${start.year}-${String(start.month).padStart(2, "0")}-01`));
    if (waterYear < 2018 || waterYear > 2040) return { ok: false, error: `${where}: water year ${waterYear} is outside 2018–2040.` };
    const kwh = Number((values[kwhCol] ?? "").trim());
    if (!Number.isFinite(kwh) || kwh < 0) return { ok: false, error: `${where}: kWh must be a number zero or greater.` };
    const dim = daysInMonth(start.year, start.month);
    const days = end.day - start.day + 1;
    const rawQuality = qualityCol >= 0 ? (values[qualityCol] ?? "").trim().toLowerCase() : "";
    let quality: "actual" | "provisional" = days < dim ? "provisional" : "actual";
    if (rawQuality) {
      if (rawQuality !== "actual" && rawQuality !== "provisional") {
        return { ok: false, error: `${where}: quality must be actual or provisional.` };
      }
      quality = rawQuality;
    }
    const periodStart = `${start.year}-${String(start.month).padStart(2, "0")}-${String(start.day).padStart(2, "0")}`;
    const periodEnd = `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`;
    const key = `${meterId}:${periodStart}`;
    if (seen.has(key)) return { ok: false, error: `${where}: ${well.name} is repeated for ${periodStart}.` };
    seen.add(key);
    rows.push({
      meterId,
      periodStart,
      periodEnd,
      days,
      daysInMonth: dim,
      kwh,
      quality,
    });
  }

  return { ok: true, rows };
}
