import { combineRelative, plantFrom, type PlantResult } from "@/lib/ledger/calc";
import {
  BASELINE_UNCERTAINTY,
  DEMO_TODAY,
  METER_UNCERTAINTY,
  OPE_UNCERTAINTY_FRESH,
  OPE_UNCERTAINTY_STALE,
  VOLUME_BENCHMARK,
  WELLS,
  periodsFor,
  type Identity,
  type Well,
} from "@/lib/ledger/catalog";
import {
  fold,
  verifyChain,
  type Folded,
  type LedgerEvent,
  type NoticeInput,
  type PumpTestInput,
  type Snapshot,
  type StoredRead,
} from "@/lib/ledger/events";
import { roundTo } from "@/lib/ledger/format";

export type Check = { label: string; pass: boolean; detail: string };

export type WellModel = {
  well: Well;
  meterKwh: number;
  pumpKwh: number;
  baselineRemoved: number;
  discardedKwh: number;
  af: number | null;
  plant: PlantResult | null;
  test: (PumpTestInput & { eventId: string }) | null;
  fresh: boolean;
  relative: number | null;
  sigmaAf: number | null;
  checks: Check[];
  monthsPresent: number;
  monthsExpected: number;
  flooredMonths: number;
};

export type MonthWell = {
  wellId: string;
  meterKwh: number | null;
  pumpKwh: number | null;
  af: number | null;
  quality: "actual" | "provisional" | null;
  origin: StoredRead["origin"] | null;
};

export type MonthModel = {
  start: string;
  end: string;
  label: string;
  short: string;
  expected: boolean;
  partial: boolean;
  wells: MonthWell[];
  totalAf: number | null;
  gap: boolean;
};

export type Comparison = {
  comparable: boolean;
  notice: NoticeInput & { eventId: string };
  ledgerAf: number;
  noticeAf: number;
  allocationAf: number;
  noticeExcessAf: number;
  ledgerExcessAf: number;
  disputeAf: number;
  disputeUsd: number;
  low: number;
  high: number;
  outside: boolean;
};

export type YearModel = {
  year: string;
  identity: Identity;
  events: LedgerEvent[];
  chainOk: boolean;
  brokenAt: number | null;
  months: MonthModel[];
  wells: WellModel[];
  preciseAf: number;
  sigmaAf: number;
  relative: number | null;
  coverageComplete: boolean;
  convertible: boolean;
  fullYear: boolean;
  portfolioWithinBenchmark: boolean;
  comparison: Comparison | null;
  snapshot: (Snapshot & { at: string }) | null;
  snapshotMatches: boolean;
  baselineKwh: number;
  baselineNote: string;
  baselineHistory: Folded["baselineEvents"];
  lastSync: Folded["lastSync"];
  activeReads: StoredRead[];
  supersededCount: number;
};

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function freshTest(testedOn: string, waterYear: string): boolean {
  const early = `${Number(waterYear) - 2}-10-01`;
  const late = `${waterYear}-11-15`;
  return testedOn >= early && testedOn <= late;
}

export function archiveStatus(events: LedgerEvent[]): string {
  const folded = fold(events);
  const sentences: string[] = [];
  let gaps = 0;
  for (const year of ["2026", "2027"]) {
    const periods = periodsFor(year).filter((period) => period.start <= DEMO_TODAY);
    let covered = 0;
    for (const period of periods) {
      const ok = WELLS.every((well) =>
        folded.reads.some(
          (read) => !read.superseded && read.meterId === well.meterId && read.periodStart === period.start,
        ),
      );
      if (ok) covered += 1;
      else gaps += 1;
    }
    sentences.push(
      year === "2027"
        ? `Water year 2027 has ${covered} of ${periods.length} expected months, with October provisional through October 12.`
        : `Water year 2026 has ${covered} of ${periods.length} settled months.`,
    );
  }
  sentences.push(gaps === 0 ? "No gaps." : `${gaps} expected months are missing.`);
  return sentences.join(" ");
}

export function yearsIn(events: LedgerEvent[]): string[] {
  const years = new Set<string>(["2026", "2027"]);
  const folded = fold(events);
  for (const read of folded.reads) years.add(read.waterYear);
  for (const year of Object.keys(folded.notices)) years.add(year);
  return [...years].sort();
}

function activeRead(reads: StoredRead[], meterId: string, start: string): StoredRead | undefined {
  return reads.find((read) => !read.superseded && read.meterId === meterId && read.periodStart === start);
}

export function deriveYear(events: LedgerEvent[], year: string): YearModel {
  const chain = verifyChain(events);
  const folded = fold(events);
  const periods = periodsFor(year);
  const expected = periods.filter((period) => period.start <= DEMO_TODAY);
  const expectedStarts = new Set(expected.map((period) => period.start));

  const wells: WellModel[] = WELLS.map((well) => {
    const test = folded.tests[well.id] ?? null;
    const plant = test ? plantFrom(test) : null;
    const fresh = test ? freshTest(test.testedOn, year) : false;
    let meterKwh = 0;
    let pumpKwh = 0;
    let baselineRemoved = 0;
    let discardedKwh = 0;
    let monthsPresent = 0;
    let flooredMonths = 0;

    for (const period of expected) {
      const read = activeRead(folded.reads, well.meterId, period.start);
      if (!read) continue;
      monthsPresent += 1;
      meterKwh += read.kwh;
      const applied = well.dedicated ? 0 : folded.baselineKwh * (read.days / read.daysInMonth);
      baselineRemoved += applied;
      if (!well.dedicated && read.kwh < applied) {
        flooredMonths += 1;
        discardedKwh += applied - read.kwh;
        continue;
      }
      pumpKwh += well.dedicated ? read.kwh : read.kwh - applied;
    }

    const opeU = fresh ? OPE_UNCERTAINTY_FRESH : OPE_UNCERTAINTY_STALE;
    let relative: number | null = null;
    let sigmaAf: number | null = null;
    let af: number | null = null;
    if (plant?.valid && pumpKwh >= 0) {
      af = pumpKwh / plant.kwhPerAf;
      const meterSigma = METER_UNCERTAINTY * meterKwh;
      const baseSigma = well.dedicated ? 0 : BASELINE_UNCERTAINTY * baselineRemoved;
      const pumpSigma = Math.sqrt(meterSigma ** 2 + baseSigma ** 2);
      const kwhRelative = pumpKwh > 0 ? pumpSigma / pumpKwh : 0;
      relative = combineRelative(kwhRelative, opeU);
      sigmaAf = af * relative;
    }

    const coveragePass = monthsPresent === expected.length;
    const efficiencyPass = Boolean(plant?.valid && plant.ope >= 0.4 && plant.ope <= 0.8);
    const bandPass = relative != null && relative <= VOLUME_BENCHMARK;
    const baselinePass = well.dedicated || (folded.baselineNote.trim().length > 0 && folded.baselineKwh > 0);

    const checks: Check[] = [
      {
        label: "Coverage",
        pass: coveragePass,
        detail: coveragePass
          ? `${monthsPresent} of ${expected.length} expected months are on file.`
          : `${expected.length - monthsPresent} expected month${expected.length - monthsPresent === 1 ? "" : "s"} missing.`,
      },
      {
        label: "Attribution",
        pass: baselinePass,
        detail: well.dedicated
          ? "Dedicated meter. The full read is treated as pump energy, including short starts."
          : baselinePass
            ? "Shared meter. Pump energy is the read minus the monthly non-pump baseline."
            : "Shared meter without a stated non-pump baseline.",
      },
      {
        label: "Pump test",
        pass: Boolean(plant?.valid),
        detail: plant?.valid
          ? "Flow, head, and input kilowatts produce an overall plant efficiency."
          : "No usable pump test is on file for this well.",
      },
      {
        label: "Efficiency range",
        pass: efficiencyPass,
        detail: plant?.valid
          ? `Overall plant efficiency is ${(plant.ope * 100).toFixed(1)}%. The expected band on this record is 40% to 80%.`
          : "Efficiency cannot be checked without a usable test.",
      },
      {
        label: "Test currency",
        pass: Boolean(test && fresh),
        detail: test
          ? fresh
            ? `Tested ${test.testedOn}, inside the window for water year ${year}.`
            : `Tested ${test.testedOn}, outside the window for water year ${year}. Uncertainty is widened.`
          : "No test date.",
      },
      {
        label: "5% band",
        pass: bandPass,
        detail:
          relative == null
            ? "Volume band cannot be stated."
            : `Documented uncertainty is ${(relative * 100).toFixed(1)}% of this well's volume. The comparison threshold is 5%.`,
      },
    ];

    return {
      well,
      meterKwh,
      pumpKwh,
      baselineRemoved,
      discardedKwh,
      af,
      plant,
      test,
      fresh,
      relative,
      sigmaAf,
      checks,
      monthsPresent,
      monthsExpected: expected.length,
      flooredMonths,
    };
  });

  const months: MonthModel[] = periods.map((period) => {
    const isExpected = expectedStarts.has(period.start);
    const rowWells: MonthWell[] = wells.map((entry) => {
      const read = activeRead(folded.reads, entry.well.meterId, period.start);
      if (!read || !entry.plant?.valid) {
        return {
          wellId: entry.well.id,
          meterKwh: read?.kwh ?? null,
          pumpKwh: null,
          af: null,
          quality: read?.quality ?? null,
          origin: read?.origin ?? null,
        };
      }
      const applied = entry.well.dedicated ? 0 : folded.baselineKwh * (read.days / read.daysInMonth);
      const pump = entry.well.dedicated ? read.kwh : Math.max(0, read.kwh - applied);
      return {
        wellId: entry.well.id,
        meterKwh: read.kwh,
        pumpKwh: pump,
        af: pump / entry.plant.kwhPerAf,
        quality: read.quality,
        origin: read.origin,
      };
    });
    const gap = isExpected && rowWells.some((item) => item.meterKwh == null);
    const known = rowWells.filter((item) => item.af != null);
    const partial = rowWells.some((item) => item.quality === "provisional");
    return {
      start: period.start,
      end: period.end,
      label: `${SHORT[period.month - 1]} ${period.year}`,
      short: SHORT[period.month - 1],
      expected: isExpected,
      partial,
      wells: rowWells,
      totalAf: known.length === WELLS.length ? known.reduce((sum, item) => sum + (item.af ?? 0), 0) : null,
      gap,
    };
  });

  const convertible = wells.every((entry) => entry.af != null);
  const preciseAf = wells.reduce((sum, entry) => sum + (entry.af ?? 0), 0);
  const sigmaAf = Math.sqrt(wells.reduce((sum, entry) => sum + (entry.sigmaAf ?? 0) ** 2, 0));
  const relative = convertible && preciseAf > 0 ? sigmaAf / preciseAf : null;
  const coverageComplete = wells.every((entry) => entry.monthsPresent === entry.monthsExpected);
  const fullYear = expected.length === 12 && coverageComplete;
  const portfolioWithinBenchmark = Boolean(
    fullYear && convertible && relative != null && relative <= VOLUME_BENCHMARK && chain.ok,
  );

  const notice = folded.notices[year] ?? null;
  let comparison: Comparison | null = null;
  if (notice && convertible) {
    const ledgerAf = roundTo(preciseAf, 2);
    const noticeAf = roundTo(notice.etaAf - notice.precipCreditAf - notice.surfaceCreditAf, 2);
    const allocationAf = roundTo(folded.identity.acres * notice.allocationAfPerAcre, 2);
    const noticeExcessAf = roundTo(Math.max(0, noticeAf - allocationAf), 2);
    const ledgerExcessAf = roundTo(Math.max(0, ledgerAf - allocationAf), 2);
    const disputeAf = roundTo(noticeExcessAf - ledgerExcessAf, 2);
    const disputeUsd = roundTo(disputeAf * notice.ratePerAf, 2);
    const preciseNotice = notice.etaAf - notice.precipCreditAf - notice.surfaceCreditAf;
    const low = preciseAf - sigmaAf;
    const high = preciseAf + sigmaAf;
    comparison = {
      comparable: fullYear && coverageComplete,
      notice,
      ledgerAf,
      noticeAf,
      allocationAf,
      noticeExcessAf,
      ledgerExcessAf,
      disputeAf,
      disputeUsd,
      low,
      high,
      outside: preciseNotice < low || preciseNotice > high,
    };
  }

  const snapshotEvent = [...events].reverse().find((event) => event.type === "estimate.snapshot" && event.payload.waterYear === year);
  const snapshot = snapshotEvent && snapshotEvent.type === "estimate.snapshot" ? { ...snapshotEvent.payload, at: snapshotEvent.at } : null;
  const snapshotMatches = snapshot != null && Math.abs(snapshot.totalAf - preciseAf) < 1e-6;

  const activeReads = folded.reads.filter((read) => !read.superseded && read.waterYear === year);
  const supersededCount = folded.reads.filter((read) => read.superseded && read.waterYear === year).length;

  return {
    year,
    identity: folded.identity,
    events,
    chainOk: chain.ok,
    brokenAt: chain.brokenAt,
    months,
    wells,
    preciseAf,
    sigmaAf,
    relative,
    coverageComplete,
    convertible,
    fullYear,
    portfolioWithinBenchmark,
    comparison,
    snapshot,
    snapshotMatches,
    baselineKwh: folded.baselineKwh,
    baselineNote: folded.baselineNote,
    baselineHistory: folded.baselineEvents,
    lastSync: folded.lastSync,
    activeReads,
    supersededCount,
  };
}
