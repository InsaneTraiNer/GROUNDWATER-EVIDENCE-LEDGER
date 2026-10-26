import {
  BASELINE_UNCERTAINTY,
  DEMO_TODAY,
  KWH_PER_AF_FOOT,
  KW_PER_HP,
  METER_UNCERTAINTY,
  OPE_UNCERTAINTY_FRESH,
  OPE_UNCERTAINTY_STALE,
  VOLUME_BENCHMARK,
  WATER_HP_DIVISOR,
} from "@/lib/ledger/catalog";
import type { YearModel } from "@/lib/ledger/derive";
import { EVENT_LABEL } from "@/lib/ledger/events";
import { formatAf, formatDay, formatKwh, formatMonth, formatNum, formatPct, formatUsd, roundTo } from "@/lib/ledger/format";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "note"; text: string }
  | { kind: "kv"; rows: { k: string; v: string }[] }
  | { kind: "table"; caption?: string; columns: string[]; rows: string[][] };

export type Section = {
  id: string;
  kicker: string;
  title: string;
  blocks: Block[];
};

export type Point = { title: string; body: string };

function weakWells(model: YearModel) {
  return model.wells.filter((entry) => entry.checks.some((check) => !check.pass));
}

export function challengePoints(model: YearModel): Point[] {
  const dedicated = model.wells.filter((entry) => entry.well.dedicated).map((entry) => entry.well.name);
  const shared = model.wells.filter((entry) => !entry.well.dedicated).map((entry) => entry.well.name);
  const points: Point[] = [
    {
      title: "The notice and the ledger are not the same measurement",
      body: "The notice starts from evapotranspiration and subtracts precipitation and surface water. The ledger starts from pump electricity and a pump test. They are set side by side here. They are not treated as one method.",
    },
    {
      title: "Only pump energy enters the conversion",
      body: `${dedicated.join(" and ")} ${dedicated.length === 1 ? "is a dedicated meter" : "are dedicated meters"}. ${
        shared.length
          ? `${shared.join(" and ")} ${shared.length === 1 ? "is" : "are"} what remains on a shared meter after a non-pump baseline.`
          : "No shared meter is in this record."
      } Farm-wide electricity is not used.`,
    },
  ];

  if (!model.fullYear) {
    points.push({
      title: "This water year is not closed",
      body: "The ledger total is only the months on file. Do not set it against a full-year notice until the year has settled.",
    });
  } else if (model.comparison?.outside) {
    points.push({
      title: "The notice sits outside the ledger's band",
      body: `The documented band is ${formatAf(model.comparison.low)} to ${formatAf(model.comparison.high)}. The notice is outside it, so the gap is not explained by the stated meter and pump-test uncertainty.`,
    });
  } else if (model.comparison) {
    points.push({
      title: "The notice is inside the ledger's band",
      body: "On these inputs the notice falls inside the documented uncertainty. The package still preserves the measurements, but it does not claim the gap survives the error band.",
    });
  }

  const weak = weakWells(model);
  if (weak.length > 0) {
    points.push({
      title: weak.length === 1 ? `${weak[0].well.name} does not clear every check` : "Some wells do not clear every check",
      body: `${weak.map((entry) => entry.well.name).join(", ")} ${weak.length === 1 ? "fails" : "fail"} at least one validation check. ${
        model.portfolioWithinBenchmark
          ? "The year-level band can still fall inside 5% because a small well does not move the total much. Do not cite a failing well on its own."
          : "The year-level figure should not be described as meeting the 5% threshold until those checks pass."
      }`,
    });
  }

  return points;
}

export function buildBrief(model: YearModel): Section[] {
  const { identity, comparison } = model;
  const sections: Section[] = [
    {
      id: "read",
      kicker: "01",
      title: "How to read this package",
      blocks: [
        {
          kind: "p",
          text: `${identity.ranchName}, ${identity.block}, water year ${model.year}. This package separates the original meter reads, the attribution, the assumptions, the arithmetic, and the resulting volume. Later edits are appended. They do not replace the entry that first recorded a fact.`,
        },
        {
          kind: "note",
          text: "This is a measurement record for a fee comparison. It is not a filing, a water budget, or a finding that an agency must accept the ledger.",
        },
      ],
    },
    {
      id: "comparison",
      kicker: "02",
      title: "Comparison with the notice",
      blocks: comparison
        ? [
            {
              kind: "kv",
              rows: [
                { k: "Agency", v: comparison.notice.agency },
                { k: "Notice", v: comparison.notice.noticeNo },
                { k: "Issued", v: formatDay(comparison.notice.issuedOn) },
                { k: "Method on the notice", v: comparison.notice.methodNote || "Not stated." },
              ],
            },
            {
              kind: "table",
              caption: "Volumes are rounded to 0.01 acre-foot before the subtraction, so the arithmetic can be checked.",
              columns: ["Step", "Figure"],
              rows: [
                ["Evapotranspiration", formatAf(comparison.notice.etaAf)],
                ["Effective precipitation", formatAf(comparison.notice.precipCreditAf)],
                ["Surface water", formatAf(comparison.notice.surfaceCreditAf)],
                ["Notice net extraction", formatAf(comparison.noticeAf)],
                ["Ledger extraction", formatAf(comparison.ledgerAf)],
                ["Allocation", `${formatAf(comparison.allocationAf)} (${formatNum(identity.acres, 1)} ac × ${formatNum(comparison.notice.allocationAfPerAcre, 2)} AF/ac)`],
                ["Notice volume above allocation", formatAf(comparison.noticeExcessAf)],
                ["Ledger volume above allocation", formatAf(comparison.ledgerExcessAf)],
                ["Difference in excess", formatAf(comparison.disputeAf)],
                ["Rate on the notice", `${formatUsd(comparison.notice.ratePerAf)} per AF`],
                ["Amount in dispute", formatUsd(comparison.disputeUsd)],
              ],
            },
            {
              kind: "p",
              text: comparison.comparable
                ? comparison.outside
                  ? `The notice net is outside the ledger band of ${formatAf(comparison.low)} to ${formatAf(comparison.high)}.`
                  : `The notice net is inside the ledger band of ${formatAf(comparison.low)} to ${formatAf(comparison.high)}.`
                : "The ledger does not yet cover a full settled water year, so this comparison is provisional.",
            },
          ]
        : [
            {
              kind: "p",
              text: `No notice is on file for water year ${model.year}. The extraction estimate below is still being recorded.`,
            },
          ],
    },
    {
      id: "sources",
      kicker: "03",
      title: "Original source measurements",
      blocks: [
        {
          kind: "p",
          text: `Active reads for water year ${model.year}. ${model.supersededCount === 0 ? "No month has been superseded." : `${model.supersededCount} earlier read${model.supersededCount === 1 ? "" : "s"} remain in the chain and are not used in the current total.`}`,
        },
        {
          kind: "table",
          columns: ["Month", "Meter", "Well", "kWh", "Quality", "Origin"],
          rows: model.activeReads
            .slice()
            .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.meterId.localeCompare(b.meterId))
            .map((read) => {
              const well = model.wells.find((entry) => entry.well.meterId === read.meterId);
              return [
                formatMonth(read.periodStart),
                read.meterId,
                well?.well.name ?? read.meterId,
                formatNum(read.kwh, 0),
                read.quality,
                read.origin === "pge-archive" ? "PG&E archive" : "CSV import",
              ];
            }),
        },
      ],
    },
    {
      id: "attribution",
      kicker: "04",
      title: "Pump attribution",
      blocks: [
        {
          kind: "p",
          text: "Each well is tied to one service. Dedicated meters contribute their whole read. The shared headquarters meter contributes the read minus the current baseline, scaled by the days covered in a partial month, and never below zero.",
        },
        {
          kind: "table",
          columns: ["Well", "Meter", "Service", "Method", "Meter kWh", "Pump kWh"],
          rows: model.wells.map((entry) => [
            entry.well.name,
            entry.well.meterId,
            entry.well.serviceId,
            entry.well.dedicated ? "Dedicated" : "Baseline subtraction",
            formatNum(entry.meterKwh, 0),
            formatNum(entry.pumpKwh, 0),
          ]),
        },
        {
          kind: "note",
          text: `Current headquarters baseline: ${formatKwh(model.baselineKwh)} per full month. ${model.baselineNote}`,
        },
      ],
    },
    {
      id: "conversion",
      kicker: "05",
      title: "Conversion",
      blocks: [
        {
          kind: "p",
          text: `Water horsepower = gpm × head / ${formatNum(WATER_HP_DIVISOR, 0)}. Input horsepower = kW / ${KW_PER_HP}. Overall plant efficiency = water horsepower / input horsepower. Kilowatt-hours per acre-foot = ${KWH_PER_AF_FOOT} × head / efficiency. Acre-feet = pump kilowatt-hours / that factor.`,
        },
        {
          kind: "table",
          columns: ["Well", "Tested", "gpm", "Head", "kW", "Efficiency", "kWh/AF", "Acre-feet"],
          rows: model.wells.map((entry) => [
            entry.well.name,
            entry.test ? formatDay(entry.test.testedOn) : "—",
            entry.test ? formatNum(entry.test.gpm, 0) : "—",
            entry.test ? `${formatNum(entry.test.tdhFt, 0)} ft` : "—",
            entry.test ? formatNum(entry.test.inputKw, 1) : "—",
            entry.plant?.valid ? formatPct(entry.plant.ope) : "—",
            entry.plant?.valid ? formatNum(entry.plant.kwhPerAf, 2) : "—",
            entry.af == null ? "—" : formatAf(entry.af),
          ]),
        },
      ],
    },
    {
      id: "assumptions",
      kicker: "06",
      title: "Assumptions",
      blocks: [
        {
          kind: "table",
          columns: ["Item", "Value used"],
          rows: [
            ["Lift constant", `${KWH_PER_AF_FOOT} kWh per acre-foot per foot of head, at 100% efficiency`],
            ["Water-horsepower divisor", String(WATER_HP_DIVISOR)],
            ["Kilowatts per horsepower", String(KW_PER_HP)],
            ["SmartMeter bound", formatPct(METER_UNCERTAINTY) + ", treated as systematic within a well"],
            ["Current pump test", formatPct(OPE_UNCERTAINTY_FRESH) + " of volume"],
            ["Stale pump test", formatPct(OPE_UNCERTAINTY_STALE) + " of volume"],
            ["Baseline bound", formatPct(BASELINE_UNCERTAINTY) + " of the subtracted kilowatt-hours"],
            ["Comparison threshold", formatPct(VOLUME_BENCHMARK) + ", the State Water Board figure for a calibrated totalizing flow meter"],
            ["Nameplate horsepower", "Shown for identification only. Not used in the volume."],
            ["Allocation and rate", "Taken from the notice. Not recalculated."],
          ],
        },
        {
          kind: "p",
          text: "Meter error and pump-test error are treated as systematic across the months of a well. Wells are treated as independent of one another. The band is a documented uncertainty, not a confidence interval from a sampling study. The State Water Board's measuring guidance does not accept power consumption alone; it allows a power-and-pump-test method case by case. This record documents that pairing. It does not claim the Board has approved the filing.",
        },
        {
          kind: "p",
          text: model.baselineHistory
            .map((entry) => `${formatDay(entry.at)}: ${formatKwh(entry.monthlyKwh)} per month. ${entry.note}`)
            .join(" "),
        },
      ],
    },
    {
      id: "estimate",
      kicker: "07",
      title: "Resulting estimate",
      blocks: [
        {
          kind: "kv",
          rows: [
            { k: "Water year", v: model.year },
            { k: "Unrounded volume", v: `${formatNum(model.preciseAf, 4)} AF` },
            { k: "Published volume", v: formatAf(comparison?.ledgerAf ?? roundTo(model.preciseAf, 2)) },
            {
              k: "Documented band",
              v: model.relative == null ? "Not stated" : `${formatAf(model.sigmaAf)} (${formatPct(model.relative)})`,
            },
            {
              k: "Year-level 5% threshold",
              v: model.portfolioWithinBenchmark ? "Within the threshold" : "Not within the threshold",
            },
            {
              k: "Snapshot",
              v: model.snapshot
                ? model.snapshotMatches
                  ? `Matches the estimate stored on ${formatDay(model.snapshot.at)}.`
                  : `Differs from the ${formatAf(model.snapshot.totalAf)} stored on ${formatDay(model.snapshot.at)}. Both figures stay in the chain.`
                : "No snapshot has been stored for this year.",
            },
          ],
        },
        {
          kind: "table",
          caption: "Validation checks",
          columns: ["Well", "Check", "Result", "Detail"],
          rows: model.wells.flatMap((entry) =>
            entry.checks.map((check) => [entry.well.name, check.label, check.pass ? "Pass" : "Fail", check.detail]),
          ),
        },
      ],
    },
    {
      id: "chain",
      kicker: "08",
      title: "Chain of custody",
      blocks: [
        {
          kind: "p",
          text: model.chainOk
            ? `SHA-256 chain intact. ${model.events.length} entries. Each entry is hashed with the hash of the one before it. Genesis is the literal GENESIS.`
            : `Chain broken at entry ${model.brokenAt ?? "unknown"}. Do not rely on this export until the record is restored.`,
        },
        {
          kind: "table",
          columns: ["#", "When", "Kind", "Summary", "Hash"],
          rows: model.events.map((event) => [
            String(event.seq),
            formatDay(event.at),
            EVENT_LABEL[event.type],
            event.summary,
            event.hash.slice(0, 16),
          ]),
        },
      ],
    },
    {
      id: "limits",
      kicker: "09",
      title: "Limits",
      blocks: [
        {
          kind: "p",
          text: "The sample archive is not a live PG&E Share My Data session. A CSV import is the path for a ranch's own reads. Land IQ's published materials distinguish water consumed by the crop from water applied through a meter; this package does not adopt an error percentage for the agency's model, because the two methods are not measuring the same quantity. Head and efficiency are assumed to hold for the year after the test. A falling water table, a worn bowl, or a changed discharge pressure will move the true volume. Have counsel review the package before it is given to an agency.",
        },
        {
          kind: "note",
          text: `Demonstration clock ${formatDay(DEMO_TODAY)}. Dollars, where shown, use the notice's rate and acre-feet rounded to the nearest hundredth.`,
        },
      ],
    },
  ];

  return sections;
}

export function evidenceData(model: YearModel, generatedAt: string) {
  return {
    schema: "groundwater-evidence-ledger/v1",
    generatedAt,
    demonstrationClock: DEMO_TODAY,
    waterYear: model.year,
    identity: model.identity,
    chainIntact: model.chainOk,
    estimate: {
      preciseAcreFeet: model.preciseAf,
      roundedAcreFeet: model.comparison?.ledgerAf ?? roundTo(model.preciseAf, 2),
      uncertaintyAcreFeet: model.sigmaAf,
      relativeUncertainty: model.relative,
      portfolioWithinFivePercent: model.portfolioWithinBenchmark,
      byWell: model.wells.map((entry) => ({
        id: entry.well.id,
        name: entry.well.name,
        meterId: entry.well.meterId,
        dedicated: entry.well.dedicated,
        meterKwh: entry.meterKwh,
        pumpKwh: entry.pumpKwh,
        acreFeet: entry.af,
        kwhPerAcreFoot: entry.plant?.valid ? entry.plant.kwhPerAf : null,
        overallPlantEfficiency: entry.plant?.valid ? entry.plant.ope : null,
        uncertaintyAcreFeet: entry.sigmaAf,
        checks: entry.checks,
      })),
    },
    comparison: model.comparison,
    reads: model.activeReads,
    assumptions: {
      baselineKwhPerMonth: model.baselineKwh,
      baselineNote: model.baselineNote,
      history: model.baselineHistory,
      constants: {
        kwhPerAfFoot: KWH_PER_AF_FOOT,
        waterHpDivisor: WATER_HP_DIVISOR,
        kwPerHp: KW_PER_HP,
        meterUncertainty: METER_UNCERTAINTY,
        freshTestUncertainty: OPE_UNCERTAINTY_FRESH,
        staleTestUncertainty: OPE_UNCERTAINTY_STALE,
        baselineUncertainty: BASELINE_UNCERTAINTY,
        benchmark: VOLUME_BENCHMARK,
      },
    },
    events: model.events,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

export function briefHtml(model: YearModel, generatedAt: string): string {
  const sections = buildBrief(model);
  const title = `${model.identity.ranchName} ${model.identity.block} — water year ${model.year}`;
  const body = sections
    .map((section) => {
      const blocks = section.blocks
        .map((block) => {
          if (block.kind === "p") return `<p>${escapeHtml(block.text)}</p>`;
          if (block.kind === "note") return `<p class="note">${escapeHtml(block.text)}</p>`;
          if (block.kind === "kv") {
            return `<dl>${block.rows.map((row) => `<dt>${escapeHtml(row.k)}</dt><dd>${escapeHtml(row.v)}</dd>`).join("")}</dl>`;
          }
          const caption = block.caption ? `<caption>${escapeHtml(block.caption)}</caption>` : "";
          const head = block.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
          const rows = block.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
            .join("");
          return `<table>${caption}<thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
        })
        .join("");
      return `<section><p class="kicker">${section.kicker}</p><h2>${escapeHtml(section.title)}</h2>${blocks}</section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #f1f0ec; color: #1a1c1e; font: 15px/1.5 "Iowan Old Style", Palatino, Georgia, serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }
  h1 { font-weight: 500; font-size: 40px; line-height: 1.1; letter-spacing: -0.03em; margin: 8px 0 12px; }
  h2 { font-weight: 500; font-size: 26px; letter-spacing: -0.02em; margin: 0 0 12px; }
  p { margin: 0 0 12px; }
  .kicker { font: 12px/1.4 "Segoe UI", sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #4f555a; margin: 0; }
  .note { color: #4f555a; }
  section { padding: 28px 0; border-top: 1px solid #ddd9d2; }
  dl { display: grid; grid-template-columns: 180px 1fr; gap: 6px 16px; margin: 0 0 16px; }
  dt { font: 13px/1.4 "Segoe UI", sans-serif; color: #4f555a; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font: 13px/1.4 "Segoe UI", sans-serif; }
  th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #ddd9d2; }
  th { color: #4f555a; font-weight: 500; }
  caption { caption-side: bottom; text-align: left; color: #4f555a; padding-top: 6px; }
  .meta { font: 13px/1.4 "Segoe UI", sans-serif; color: #4f555a; }
</style>
</head>
<body>
<main>
  <p class="kicker">Groundwater Evidence Ledger</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Generated ${escapeHtml(generatedAt)}. Chain ${model.chainOk ? "intact" : "broken"}.</p>
  ${body}
</main>
</body>
</html>`;
}
