import type { Identity } from "@/lib/ledger/catalog";
import { waterYearOf } from "@/lib/ledger/catalog";
import { canonicalize, sha256Hex } from "@/lib/ledger/hash";

export const GENESIS = "GENESIS";

export type PumpTestInput = {
  wellId: string;
  testedOn: string;
  tester: string;
  gpm: number;
  tdhFt: number;
  inputKw: number;
  note: string;
};

export type NoticeInput = {
  waterYear: string;
  agency: string;
  noticeNo: string;
  issuedOn: string;
  etaAf: number;
  precipCreditAf: number;
  surfaceCreditAf: number;
  allocationAfPerAcre: number;
  ratePerAf: number;
  methodNote: string;
};

export type MonthBatch = {
  periodStart: string;
  periodEnd: string;
  days: number;
  daysInMonth: number;
  origin: "pge-archive" | "csv-import";
  quality: "actual" | "provisional";
  reads: { meterId: string; kwh: number }[];
};

export type ImportedRow = {
  meterId: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  daysInMonth: number;
  kwh: number;
  quality: "actual" | "provisional";
};

export type Snapshot = {
  waterYear: string;
  totalAf: number;
  sigmaAf: number;
  byWell: { wellId: string; af: number }[];
};

type Base = {
  seq: number;
  id: string;
  at: string;
  summary: string;
  prevHash: string;
  hash: string;
};

export type LedgerEvent =
  | (Base & { type: "record.opened"; payload: Identity })
  | (Base & { type: "record.revised"; payload: Identity })
  | (Base & { type: "attribution.set"; payload: { rules: { wellId: string; meterId: string; method: string }[] } })
  | (Base & { type: "assumption.baseline"; payload: { monthlyKwh: number; note: string } })
  | (Base & { type: "pump.tested"; payload: PumpTestInput })
  | (Base & { type: "meter.read"; payload: MonthBatch })
  | (Base & { type: "meter.imported"; payload: { rows: ImportedRow[] } })
  | (Base & { type: "notice.imported"; payload: NoticeInput })
  | (Base & { type: "estimate.snapshot"; payload: Snapshot })
  | (Base & { type: "sync.checked"; payload: { asOf: string } });

export type Draft = Omit<LedgerEvent, "seq" | "id" | "prevHash" | "hash">;

export type StoredRead = {
  meterId: string;
  waterYear: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  daysInMonth: number;
  kwh: number;
  quality: "actual" | "provisional";
  origin: "pge-archive" | "csv-import";
  eventId: string;
  superseded: boolean;
};

export type Folded = {
  identity: Identity;
  reads: StoredRead[];
  tests: Record<string, PumpTestInput & { eventId: string }>;
  notices: Record<string, NoticeInput & { eventId: string }>;
  baselineKwh: number;
  baselineNote: string;
  baselineEvents: { at: string; monthlyKwh: number; note: string }[];
  lastSync: { at: string; summary: string } | null;
};

export const EVENT_LABEL: Record<LedgerEvent["type"], string> = {
  "record.opened": "Record opened",
  "record.revised": "Caption revised",
  "attribution.set": "Attribution",
  "assumption.baseline": "Baseline",
  "pump.tested": "Pump test",
  "meter.read": "Meter read",
  "meter.imported": "Import",
  "notice.imported": "Notice",
  "estimate.snapshot": "Estimate",
  "sync.checked": "Archive check",
};

export function appendEvent(events: LedgerEvent[], draft: Draft): LedgerEvent[] {
  const seq = events.length + 1;
  const prevHash = events.length === 0 ? GENESIS : events[events.length - 1].hash;
  const id = `E${String(seq).padStart(4, "0")}`;
  const body = { ...draft, seq, id, prevHash };
  const hash = sha256Hex(canonicalize(body));
  return [...events, { ...body, hash } as LedgerEvent];
}

export function verifyChain(events: LedgerEvent[]): { ok: boolean; brokenAt: number | null } {
  let previous = GENESIS;
  for (const event of events) {
    if (event.prevHash !== previous) return { ok: false, brokenAt: event.seq };
    const { hash, ...body } = event;
    try {
      if (sha256Hex(canonicalize(body)) !== hash) return { ok: false, brokenAt: event.seq };
    } catch {
      return { ok: false, brokenAt: event.seq };
    }
    previous = event.hash;
  }
  return { ok: true, brokenAt: null };
}

function supersede(reads: StoredRead[], meterId: string, periodStart: string) {
  for (const read of reads) {
    if (!read.superseded && read.meterId === meterId && read.periodStart === periodStart) {
      read.superseded = true;
    }
  }
}

function pushRead(
  reads: StoredRead[],
  eventId: string,
  origin: "pge-archive" | "csv-import",
  quality: "actual" | "provisional",
  row: {
    meterId: string;
    periodStart: string;
    periodEnd: string;
    days: number;
    daysInMonth: number;
    kwh: number;
  },
) {
  supersede(reads, row.meterId, row.periodStart);
  reads.push({
    meterId: row.meterId,
    waterYear: waterYearOf(row.periodStart),
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    days: row.days,
    daysInMonth: row.daysInMonth,
    kwh: row.kwh,
    quality,
    origin,
    eventId,
    superseded: false,
  });
}

export function fold(events: LedgerEvent[]): Folded {
  const folded: Folded = {
    identity: {
      ranchName: "",
      block: "",
      operator: "",
      county: "",
      apn: "",
      crop: "",
      acres: 0,
      utility: "",
      account: "",
    },
    reads: [],
    tests: {},
    notices: {},
    baselineKwh: 0,
    baselineNote: "",
    baselineEvents: [],
    lastSync: null,
  };

  for (const event of events) {
    switch (event.type) {
      case "record.opened":
      case "record.revised":
        folded.identity = event.payload;
        break;
      case "assumption.baseline":
        folded.baselineKwh = event.payload.monthlyKwh;
        folded.baselineNote = event.payload.note;
        folded.baselineEvents.push({ at: event.at, ...event.payload });
        break;
      case "pump.tested":
        folded.tests[event.payload.wellId] = { ...event.payload, eventId: event.id };
        break;
      case "meter.read":
        for (const read of event.payload.reads) {
          pushRead(folded.reads, event.id, event.payload.origin, event.payload.quality, {
            meterId: read.meterId,
            periodStart: event.payload.periodStart,
            periodEnd: event.payload.periodEnd,
            days: event.payload.days,
            daysInMonth: event.payload.daysInMonth,
            kwh: read.kwh,
          });
        }
        break;
      case "meter.imported":
        for (const row of event.payload.rows) {
          pushRead(folded.reads, event.id, "csv-import", row.quality, row);
        }
        break;
      case "notice.imported":
        folded.notices[event.payload.waterYear] = { ...event.payload, eventId: event.id };
        break;
      case "sync.checked":
        folded.lastSync = { at: event.at, summary: event.summary };
        break;
      default:
        break;
    }
  }

  return folded;
}
