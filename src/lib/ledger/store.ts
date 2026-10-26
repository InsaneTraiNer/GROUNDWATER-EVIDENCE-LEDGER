import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { wellById, DEMO_TODAY, type Identity } from "@/lib/ledger/catalog";
import { parseMeterCsv } from "@/lib/ledger/csv";
import { deriveYear, type YearModel } from "@/lib/ledger/derive";
import { appendEvent, fold, type LedgerEvent, type NoticeInput, type PumpTestInput } from "@/lib/ledger/events";
import { formatKwh } from "@/lib/ledger/format";
import { DEMO_EVENTS, DEMO_TAIL } from "@/lib/ledger/seed";
import { validateBaseline, validateIdentity, validateNotice, validateTest } from "@/lib/ledger/validate";

const STORAGE_KEY = "gel.ledger.v1";

type LedgerState = {
  events: LedgerEvent[];
  hydrated: boolean;
  hydrate: () => void;
  restore: () => void;
  checkArchive: () => { appended: boolean; summary: string };
  importCsv: (text: string) => { ok: true; added: number; replaced: number } | { ok: false; error: string };
  reviseTest: (input: PumpTestInput) => string | null;
  reviseBaseline: (monthlyKwh: number, note: string) => string | null;
  reviseNotice: (input: NoticeInput) => string | null;
  reviseIdentity: (input: Identity) => string | null;
};

function persist(events: LedgerEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events }));
}

function load(): LedgerEvent[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; events?: LedgerEvent[] };
    if (parsed.version !== 1 || !Array.isArray(parsed.events) || parsed.events.length === 0) return null;
    if (!parsed.events.every((event) => event && typeof event.hash === "string" && typeof event.type === "string")) {
      return null;
    }
    return parsed.events;
  } catch {
    return null;
  }
}

const bridge: { set?: (partial: Partial<LedgerState>) => void } = {};

function commit(events: LedgerEvent[]) {
  persist(events);
  bridge.set?.({ events });
}

export const useLedger = create<LedgerState>((set, get) => {
  bridge.set = set;
  return {
  events: DEMO_EVENTS,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const stored = load();
    set({ hydrated: true, events: stored ?? get().events });
  },
  restore: () => {
    persist(DEMO_EVENTS);
    set({ events: DEMO_EVENTS });
  },
  checkArchive: () => {
    const existing = [...get().events]
      .reverse()
      .find((event) => event.type === "sync.checked" && event.at.slice(0, 10) === DEMO_TODAY);
    if (existing) return { appended: false, summary: existing.summary };
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "sync.checked",
      summary: "Archive checked against the demonstration clock. No new settled month.",
      payload: { asOf: DEMO_TODAY },
    });
    commit(next);
    return { appended: true, summary: next[next.length - 1].summary };
  },
  importCsv: (text) => {
    const parsed = parseMeterCsv(text);
    if (!parsed.ok) return parsed;
    const folded = fold(get().events);
    let replaced = 0;
    for (const row of parsed.rows) {
      if (folded.reads.some((read) => !read.superseded && read.meterId === row.meterId && read.periodStart === row.periodStart)) {
        replaced += 1;
      }
    }
    const noun = parsed.rows.length === 1 ? "read" : "reads";
    const summary =
      replaced > 0
        ? `Imported ${parsed.rows.length} ${noun}. ${replaced} replaced an earlier month, which stays in the chain.`
        : `Imported ${parsed.rows.length} ${noun}.`;
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "meter.imported",
      summary,
      payload: { rows: parsed.rows },
    });
    commit(next);
    return { ok: true, added: parsed.rows.length, replaced };
  },
  reviseTest: (input) => {
    const error = validateTest(input);
    if (error) return error;
    const name = wellById(input.wellId)?.name ?? "Well";
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "pump.tested",
      summary: `Pump test revised for ${name}.`,
      payload: { ...input, tester: input.tester.trim(), note: input.note.trim() },
    });
    commit(next);
    return null;
  },
  reviseBaseline: (monthlyKwh, note) => {
    const error = validateBaseline(monthlyKwh, note);
    if (error) return error;
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "assumption.baseline",
      summary: `Headquarters baseline revised to ${formatKwh(monthlyKwh)} per month.`,
      payload: { monthlyKwh, note: note.trim() },
    });
    commit(next);
    return null;
  },
  reviseNotice: (input) => {
    const error = validateNotice(input);
    if (error) return error;
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "notice.imported",
      summary: `Notice ${input.noticeNo.trim()} entered for water year ${input.waterYear}.`,
      payload: {
        ...input,
        agency: input.agency.trim(),
        noticeNo: input.noticeNo.trim(),
        methodNote: input.methodNote.trim(),
      },
    });
    commit(next);
    return null;
  },
  reviseIdentity: (input) => {
    const error = validateIdentity(input);
    if (error) return error;
    const cleaned: Identity = {
      ranchName: input.ranchName.trim(),
      block: input.block.trim(),
      operator: input.operator.trim(),
      county: input.county.trim(),
      apn: input.apn.trim(),
      crop: input.crop.trim(),
      acres: input.acres,
      utility: input.utility.trim(),
      account: input.account.trim(),
    };
    const next = appendEvent(get().events, {
      at: new Date().toISOString(),
      type: "record.revised",
      summary: `Record caption revised for ${cleaned.ranchName}, ${cleaned.block}.`,
      payload: cleaned,
    });
    commit(next);
    return null;
  },
};
});

export function useYearModel(year: string): YearModel {
  const events = useLedger((state) => state.events);
  return useMemo(() => deriveYear(events, year), [events, year]);
}

export function useDemoFlag(): boolean {
  const events = useLedger((state) => state.events);
  return events.length === DEMO_EVENTS.length && events[events.length - 1]?.hash === DEMO_TAIL;
}

export function useHydrateLedger() {
  const hydrate = useLedger((state) => state.hydrate);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrate();
    setReady(true);
  }, [hydrate]);
  return ready;
}
