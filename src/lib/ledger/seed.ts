import { DEFAULT_IDENTITY, periodsFor, WELLS } from "@/lib/ledger/catalog";
import { archiveStatus, deriveYear } from "@/lib/ledger/derive";
import { appendEvent, type Draft, type LedgerEvent } from "@/lib/ledger/events";
import { formatKwh, formatMonth } from "@/lib/ledger/format";

const WELL_4 = [18420, 6180, 2140, 1760, 2380, 22140, 28660, 34180, 41750, 45120, 42080, 24760];
const WELL_7 = [9720, 3080, 860, 740, 1120, 12380, 15540, 18860, 22340, 24080, 22540, 13180];
const WELL_2_PUMP = [1860, 420, 0, 0, 180, 1640, 2380, 3160, 4080, 4360, 3920, 1740];
const BASELINE = 1680;
const WELL_2 = WELL_2_PUMP.map((pump) => pump + BASELINE);

function settledAt(periodStart: string): string {
  const [yearText, monthText] = periodStart.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-06T16:00:00.000Z`;
}

function monthSummary(periodStart: string, reads: { meterId: string; kwh: number }[], provisional: boolean): string {
  const parts = WELLS.map((well) => {
    const read = reads.find((item) => item.meterId === well.meterId);
    return `${well.name} ${formatKwh(read?.kwh ?? 0)}`;
  });
  const verb = provisional ? "Provisional" : "Settled";
  return `${verb} ${formatMonth(periodStart)}. ${parts.join(", ")}.`;
}

function buildDemonstration(): LedgerEvent[] {
  const periods = periodsFor("2026");
  const drafts: Draft[] = [
    {
      at: "2025-10-02T15:00:00.000Z",
      type: "record.opened",
      summary: "Record opened for Rios Ranch, West Block, water year 2026.",
      payload: DEFAULT_IDENTITY,
    },
    {
      at: "2025-10-02T15:01:00.000Z",
      type: "attribution.set",
      summary:
        "Attribution set. Wells 4 and 7 are dedicated pump meters. Well 2 is isolated from the headquarters service by a non-pump baseline.",
      payload: {
        rules: WELLS.map((well) => ({
          wellId: well.id,
          meterId: well.meterId,
          method: well.dedicated ? "dedicated-meter" : "baseline-subtraction",
        })),
      },
    },
    {
      at: "2025-10-02T15:02:00.000Z",
      type: "assumption.baseline",
      summary: "Provisional headquarters baseline of 1,540 kWh per month, carried from the prior water year.",
      payload: {
        monthlyKwh: 1540,
        note: "Provisional. Carried from the water year 2025 headquarters lockout until this year's lockout months settle.",
      },
    },
    {
      at: "2025-10-02T15:05:00.000Z",
      type: "pump.tested",
      summary: "Well 2 pump test dated June 4, 2024 entered from the ranch file.",
      payload: {
        wellId: "well-2",
        testedOn: "2024-06-04",
        tester: "Rios Ranch, from the 2024 pump file",
        gpm: 410,
        tdhFt: 188,
        inputKw: 25,
        note: "Older wire-to-water test. Not repeated before water year 2026.",
      },
    },
  ];

  periods.forEach((period, index) => {
    const reads = [
      { meterId: "100892341", kwh: WELL_4[index] },
      { meterId: "100892358", kwh: WELL_7[index] },
      { meterId: "100892366", kwh: WELL_2[index] },
    ];
    drafts.push({
      at: settledAt(period.start),
      type: "meter.read",
      summary: monthSummary(period.start, reads, false),
      payload: {
        periodStart: period.start,
        periodEnd: period.end,
        days: period.days,
        daysInMonth: period.days,
        origin: "pge-archive",
        quality: "actual",
        reads,
      },
    });
  });

  drafts.push(
    {
      at: "2026-02-08T17:00:00.000Z",
      type: "assumption.baseline",
      summary: "Headquarters baseline corrected to 1,680 kWh after the December and January lockout.",
      payload: {
        monthlyKwh: BASELINE,
        note: "Well 2 was locked out in December 2025 and January 2026. Both headquarters reads are 1,680 kWh. That figure replaces the 1,540 kWh provisional baseline. The earlier assumption stays in the chain.",
      },
    },
    {
      at: "2026-03-18T20:00:00.000Z",
      type: "pump.tested",
      summary: "Well 4 wire-to-water test recorded.",
      payload: {
        wellId: "well-4",
        testedOn: "2026-03-18",
        tester: "Valley Pump & Motor",
        gpm: 1240,
        tdhFt: 312,
        inputKw: 118.6,
        note: "Tested at the operating water level during the irrigation season.",
      },
    },
    {
      at: "2026-03-18T20:10:00.000Z",
      type: "pump.tested",
      summary: "Well 7 wire-to-water test recorded.",
      payload: {
        wellId: "well-7",
        testedOn: "2026-03-18",
        tester: "Valley Pump & Motor",
        gpm: 860,
        tdhFt: 274,
        inputKw: 72.5,
        note: "Tested the same day as Well 4, at the operating water level.",
      },
    },
    {
      at: "2026-10-09T17:00:00.000Z",
      type: "notice.imported",
      summary: "West San Joaquin GSA notice WSJ-WY2026-04418 entered.",
      payload: {
        waterYear: "2026",
        agency: "West San Joaquin Groundwater Sustainability Agency",
        noticeNo: "WSJ-WY2026-04418",
        issuedOn: "2026-10-08",
        etaAf: 1214,
        precipCreditAf: 86.4,
        surfaceCreditAf: 43,
        allocationAfPerAcre: 1.2,
        ratePerAf: 175,
        methodNote:
          "Net groundwater extraction estimated from Land IQ evapotranspiration, minus effective precipitation and surface-water deliveries reported to the agency.",
      },
    },
  );

  drafts.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let events = drafts.reduce((chain, draft) => appendEvent(chain, draft), [] as LedgerEvent[]);
  const closed = deriveYear(events, "2026");
  events = appendEvent(events, {
    at: "2026-10-09T18:00:00.000Z",
    type: "estimate.snapshot",
    summary: "Water year 2026 volume recomputed when the notice was entered.",
    payload: {
      waterYear: "2026",
      totalAf: closed.preciseAf,
      sigmaAf: closed.sigmaAf,
      byWell: closed.wells.map((entry) => ({ wellId: entry.well.id, af: entry.af ?? 0 })),
    },
  });

  const october = periodsFor("2027")[0];
  events = appendEvent(events, {
    at: "2026-10-12T15:00:00.000Z",
    type: "meter.read",
    summary: monthSummary(
      october.start,
      [
        { meterId: "100892341", kwh: 7086 },
        { meterId: "100892358", kwh: 3744 },
        { meterId: "100892366", kwh: 1358 },
      ],
      true,
    ),
    payload: {
      periodStart: october.start,
      periodEnd: "2026-10-12",
      days: 12,
      daysInMonth: october.days,
      origin: "pge-archive",
      quality: "provisional",
      reads: [
        { meterId: "100892341", kwh: 7086 },
        { meterId: "100892358", kwh: 3744 },
        { meterId: "100892366", kwh: 1358 },
      ],
    },
  });

  events = appendEvent(events, {
    at: "2026-10-12T15:30:00.000Z",
    type: "sync.checked",
    summary: archiveStatus(events),
    payload: { asOf: "2026-10-12" },
  });

  return events;
}

export const DEMO_EVENTS = buildDemonstration();
export const DEMO_TAIL = DEMO_EVENTS[DEMO_EVENTS.length - 1]?.hash ?? "";
