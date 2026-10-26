import { plantFrom } from "@/lib/ledger/calc";
import { wellById, type Identity } from "@/lib/ledger/catalog";
import type { NoticeInput, PumpTestInput } from "@/lib/ledger/events";

function dateOk(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateTest(input: PumpTestInput): string | null {
  if (!wellById(input.wellId)) return "Unknown well.";
  if (!dateOk(input.testedOn)) return "Enter the test date.";
  if (!input.tester.trim()) return "Name the tester.";
  if (!(input.gpm > 0)) return "Flow must be greater than zero.";
  if (!(input.tdhFt > 0)) return "Head must be greater than zero.";
  if (!(input.inputKw > 0)) return "Input kilowatts must be greater than zero.";
  if (!plantFrom(input).valid) return "Those inputs do not produce an efficiency.";
  return null;
}

export function validateBaseline(monthlyKwh: number, note: string): string | null {
  if (!Number.isFinite(monthlyKwh) || monthlyKwh < 0 || monthlyKwh > 1_000_000) {
    return "Baseline must be between 0 and 1,000,000 kWh.";
  }
  if (!note.trim()) return "Say why this baseline is the right figure.";
  return null;
}

export function validateNotice(input: NoticeInput): string | null {
  if (!/^\d{4}$/.test(input.waterYear)) return "Water year is missing.";
  if (!input.agency.trim()) return "Name the agency.";
  if (!input.noticeNo.trim()) return "Enter the notice number.";
  if (!dateOk(input.issuedOn)) return "Enter the notice date.";
  const numbers: [string, number][] = [
    ["Evapotranspiration", input.etaAf],
    ["Precipitation credit", input.precipCreditAf],
    ["Surface-water credit", input.surfaceCreditAf],
    ["Allocation", input.allocationAfPerAcre],
    ["Rate", input.ratePerAf],
  ];
  for (const [label, value] of numbers) {
    if (!Number.isFinite(value) || value < 0) return `${label} must be zero or greater.`;
  }
  return null;
}

export function validateIdentity(input: Identity): string | null {
  if (!input.ranchName.trim() || !input.block.trim() || !input.operator.trim()) {
    return "Ranch, block, and operator are required.";
  }
  if (!input.county.trim() || !input.apn.trim()) return "County and APN are required.";
  if (!input.crop.trim()) return "Name the crop.";
  if (!(input.acres > 0) || input.acres > 1_000_000) return "Acres must be greater than zero.";
  if (!input.utility.trim() || !input.account.trim()) return "Utility and account are required.";
  return null;
}
