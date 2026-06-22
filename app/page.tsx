"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SEGMENT_KEY,
  SEGMENT_GUILD_DATA,
  mergeSegmentBusinessData,
  type SegmentKey,
} from "@/data/segmentGuildData";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

const HeaderActionsClient = dynamic(
  () => import("@/components/HeaderActionsClient").then((module) => module.HeaderActionsClient),
  { ssr: false, loading: () => <div className="header-actions" aria-hidden="true" /> },
);

const SegmentGuildCanvas = dynamic(
  () => import("@/components/SegmentGuildCanvas").then((module) => module.SegmentGuildCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="guild-canvas-shell" aria-hidden="true">
        <div className="guild-canvas-viewport" />
      </div>
    ),
  },
);

const SegmentCardAvatar = dynamic(
  () => import("@/components/SegmentCardAvatar").then((module) => module.SegmentCardAvatar),
  {
    ssr: false,
    loading: () => <div className="segment-card-avatar-shell" aria-hidden="true" />,
  },
);

const objectiveTone: Record<string, string> = {
  "defend margin": "objective-gold",
  upsell: "objective-emerald",
  retain: "objective-sky",
  reactivate: "objective-rose",
  deprioritize: "objective-slate",
};

async function fileToBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read file."));
        return;
      }
      resolve(reader.result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [selectedKey, setSelectedKey] = useState<SegmentKey>(DEFAULT_SEGMENT_KEY);
  const [segments, setSegments] = useState(SEGMENT_GUILD_DATA);
  const [totalRevenue, setTotalRevenue] = useState(1_240_000);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [showSampleFormat, setShowSampleFormat] = useState(false);
  const [showSampleData, setShowSampleData] = useState(false);
  const [conversationPaused, setConversationPaused] = useState(false);
  const [dataSourceLine, setDataSourceLine] = useState("* Current view is based on demo data.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string>("Processing data...");
  const [processingProgress, setProcessingProgress] = useState(10);

  useEffect(() => {
    if (!isProcessing) return;

    setProcessingProgress(12);
    const interval = window.setInterval(() => {
      setProcessingProgress((current) => Math.min(92, current + (current < 55 ? 9 : current < 78 ? 5 : 2)));
    }, 260);

    return () => window.clearInterval(interval);
  }, [isProcessing]);

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.key === selectedKey) ?? segments[0],
    [segments, selectedKey],
  );

  const revenueShareLeader = useMemo(
    () => segments.reduce((best, segment) => (segment.revenueShare > best.revenueShare ? segment : best), segments[0]),
    [segments],
  );

  const highestUrgency = useMemo(
    () => segments.find((segment) => segment.key === "Dormant|High Frequency") ?? segments[0],
    [segments],
  );

  const fastestLift = useMemo(
    () => segments.find((segment) => segment.key === "Recent|Low Frequency") ?? segments[0],
    [segments],
  );

  const selectedRevenue = selectedSegment.revenueShare * totalRevenue;

  const processDataset = async (input: { mode: "sample" } | { mode: "upload"; file: File }) => {
    try {
      setImportWarning(null);
      setIsProcessing(true);
      setProcessingLabel(input.mode === "sample" ? "Processing sample data..." : "Processing uploaded data...");

      const payload =
        input.mode === "sample"
          ? { mode: "sample" as const }
          : {
              mode: "upload" as const,
              fileName: input.file.name,
              mimeType: input.file.type,
              fileBase64: await fileToBase64(input.file),
            };

      const response = await fetch("/api/segment-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error ?? "Data processing failed. Please try again.");
      }

      setProcessingProgress(100);
      const mergedSegments = mergeSegmentBusinessData(SEGMENT_GUILD_DATA, result.segments ?? []);
      setSegments(mergedSegments);
      setTotalRevenue(typeof result.totalRevenue === "number" ? result.totalRevenue : 1_240_000);
      setSelectedKey(DEFAULT_SEGMENT_KEY);
      setDataSourceLine(
        input.mode === "sample" ? "* Current view is based on sample data." : `* Current view is based on uploaded data from ${input.file.name}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data processing failed. Please try again.";
      setImportWarning(message);
    } finally {
      window.setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(10);
      }, 220);
    }
  };

  return (
    <main className="guild-shell">
      <section className="guild-board">
        <header className="guild-header panel">
          <div className="title-stack">
            <p className="eyebrow" suppressHydrationWarning>
              Segment Guild
            </p>
            <h1 suppressHydrationWarning>Customer Segment Studio</h1>
            <p className="lead-copy" suppressHydrationWarning>
              Turn customer order data into nine clear customer groups, with recommended actions for growth,
              retention, reactivation, and prioritization. Based on RFM: Recency, Frequency, and Monetary value.
            </p>
          </div>

          <HeaderActionsClient
            isProcessing={isProcessing}
            dataSourceLine={dataSourceLine}
            processingLabel={processingLabel}
            processingProgress={processingProgress}
            importWarning={importWarning}
            onLoadSample={() => void processDataset({ mode: "sample" })}
            onOpenSampleData={() => setShowSampleData(true)}
            onOpenSampleFormat={() => setShowSampleFormat(true)}
            onUploadFile={(file) => {
              void processDataset({ mode: "upload", file });
            }}
          />
        </header>

        <section className="board-middle">
          <div className="hall-panel panel">
            <div className="panel-topline canvas-panel-topline">
              <div className="canvas-title-block">
                <p className="mini-label">Visual segment map</p>
                <h2>Living customer segment map</h2>
              </div>

              <div className="canvas-summary-rail" aria-label="Segment summary highlights">
                <article>
                  <span>Largest revenue group</span>
                  <strong>{revenueShareLeader.label}</strong>
                  <p>{percentFormatter.format(revenueShareLeader.revenueShare)} revenue share</p>
                </article>
                <article>
                  <span>Highest reactivation need</span>
                  <strong>{highestUrgency.label}</strong>
                  <p>{highestUrgency.sampleTactic}</p>
                </article>
                <article>
                  <span>Quickest growth opportunity</span>
                  <strong>{fastestLift.label}</strong>
                  <p>{fastestLift.actionPreview}</p>
                </article>
              </div>
            </div>

            <SegmentGuildCanvas
              segments={segments}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              conversationPaused={conversationPaused}
            />
          </div>

          <aside className="detail-panel panel">
            <div className="panel-topline detail-topline">
              <div>
                <p className="mini-label">Customer group</p>
                <h2>{selectedSegment.label}</h2>
              </div>
              <div className="detail-topline-actions">
                <label className="conversation-toggle" htmlFor="conversation-pause-toggle">
                  <input
                    id="conversation-pause-toggle"
                    type="checkbox"
                    checked={conversationPaused}
                    onChange={(event) => setConversationPaused(event.target.checked)}
                  />
                  <span>Keep this group selected</span>
                </label>
                <span className={`objective-pill ${objectiveTone[selectedSegment.objective]}`}>{selectedSegment.objective}</span>
              </div>
            </div>

            <p className="detail-narrative">{selectedSegment.interpretation}</p>
            <p className="detail-fantasy">{selectedSegment.fantasySummary}</p>

            <div className="detail-metrics">
              <article className="metric-card">
                <span>Customer count:</span>
                <strong>{selectedSegment.customerCount.toLocaleString("en-US")}</strong>
              </article>
              <article className="metric-card">
                <span>Revenue share:</span>
                <strong>{percentFormatter.format(selectedSegment.revenueShare)}</strong>
              </article>
              <article className="metric-card">
                <span>Revenue at stake</span>
                <strong>{currencyFormatter.format(selectedRevenue)}</strong>
              </article>
              <article className="metric-card">
                <span>Best channel</span>
                <strong>{selectedSegment.bestChannel}</strong>
              </article>
            </div>

            <dl className="detail-list">
              <div>
                <dt>KPI</dt>
                <dd>{selectedSegment.kpi}</dd>
              </div>
              <div>
                <dt>Objective</dt>
                <dd>{selectedSegment.objective}</dd>
              </div>
              <div>
                <dt>Action preview</dt>
                <dd>{selectedSegment.actionPreview}</dd>
              </div>
              <div>
                <dt>Messaging angle</dt>
                <dd>{selectedSegment.messagingAngle}</dd>
              </div>
              <div>
                <dt>Sample tactic</dt>
                <dd>{selectedSegment.sampleTactic}</dd>
              </div>
              <div>
                <dt>Time horizon</dt>
                <dd>
                  {selectedSegment.timeHorizon} · {selectedSegment.offerIntensity}
                </dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="segment-grid panel">
          <div className="panel-topline segment-grid-topline">
            <div>
              <p className="mini-label">Nine customer groups</p>
              <h2>Customer segment cards</h2>
            </div>
          </div>

          <div className="segment-cards">
            {segments.map((segment) => {
              const selected = segment.key === selectedKey;

              return (
                <button
                  key={segment.key}
                  type="button"
                  className={`segment-card ${selected ? "is-selected" : ""}`}
                  style={{
                    ["--segment-accent" as string]: segment.accent,
                    ["--segment-accent-soft" as string]: segment.accentSoft,
                  }}
                  onClick={() => setSelectedKey(segment.key)}
                  aria-pressed={selected}
                >
                  <div className="segment-card-top">
                    <div>
                      <p className="segment-card-name">{segment.label}</p>
                      <p className="segment-card-role">{segment.fantasyRole}</p>
                    </div>
                    <span className={`objective-pill segment-objective-pill ${objectiveTone[segment.objective]}`}>{segment.objective}</span>
                  </div>

                  <div className="segment-card-avatar-shell">
                    <SegmentCardAvatar
                      asset={segment.asset}
                      textureOverride={segment.textureOverride}
                      accent={segment.accent}
                      characterHeight={segment.characterHeight}
                      label={segment.label}
                    />
                  </div>

                  <div className="segment-card-stats">
                    <article className="segment-stat-card">
                      <span>Customer count:</span>
                      <strong>{segment.customerCount.toLocaleString("en-US")}</strong>
                    </article>
                    <article className="segment-stat-card">
                      <span>Revenue share:</span>
                      <strong>{percentFormatter.format(segment.revenueShare)}</strong>
                    </article>
                  </div>

                  <div className="segment-card-next">
                    <span className="segment-card-next-label">Next move:</span>
                    <p>{segment.actionPreview}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {showSampleFormat ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowSampleFormat(false)}>
            <div
              className="sample-format-modal panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sample-format-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sample-format-modal-top">
                <div>
                  <p className="mini-label">Import format</p>
                  <h2 id="sample-format-title">Sample data format</h2>
                </div>
                <button className="sample-format-close" type="button" onClick={() => setShowSampleFormat(false)}>
                  Close
                </button>
              </div>

              <div className="sample-format-body">
                <p>
                  <strong>CSV</strong> or <strong>Excel</strong> (first tab).
                </p>

                <div className="sample-format-section">
                  <span>Columns</span>
                  <div className="sample-pill-row">
                    <code>customer_uid</code>
                    <code>purchase_date</code>
                    <code>total</code>
                  </div>
                  <p className="sample-format-note">Any customer UID format is fine as long as each customer UID is unique and used consistently.</p>
                </div>

                <div className="sample-format-section">
                  <span>Sample</span>
                  <div className="sample-format-table" role="table" aria-label="Sample import data">
                    <div className="sample-format-row sample-format-row-head" role="row">
                      <span role="columnheader">customer_uid</span>
                      <span role="columnheader">purchase_date</span>
                      <span role="columnheader">total</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">CUST_001</span>
                      <span role="cell">2026-06-01</span>
                      <span role="cell">120.50</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">CUST_001</span>
                      <span role="cell">2026-06-14</span>
                      <span role="cell">89.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">CUST_002</span>
                      <span role="cell">2026-05-22</span>
                      <span role="cell">45.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">CUST_003</span>
                      <span role="cell">2026-06-18</span>
                      <span role="cell">210.00</span>
                    </div>
                  </div>
                </div>

                <a className="sample-format-download" href="/sample-segment-guild-format.csv" target="_blank" rel="noreferrer">
                  Download sample CSV
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {showSampleData ? (
          <div className="modal-backdrop" role="presentation" onClick={() => setShowSampleData(false)}>
            <div
              className="sample-format-modal panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sample-data-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sample-format-modal-top">
                <div>
                  <p className="mini-label">Sample data</p>
                  <h2 id="sample-data-title">Sample data preview</h2>
                </div>
                <button className="sample-format-close" type="button" onClick={() => setShowSampleData(false)}>
                  Close
                </button>
              </div>

              <div className="sample-format-body">
                <p>A portion of the sample dataset used by <strong>Load sample data</strong>.</p>

                <div className="sample-format-section">
                  <span>Preview</span>
                  <div className="sample-format-table" role="table" aria-label="Sample backend data preview">
                    <div className="sample-format-row sample-format-row-head" role="row">
                      <span role="columnheader">customer_uid</span>
                      <span role="columnheader">purchase_date</span>
                      <span role="columnheader">total</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">VIP_001</span>
                      <span role="cell">2026-06-20</span>
                      <span role="cell">240.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">VIP_001</span>
                      <span role="cell">2026-06-10</span>
                      <span role="cell">195.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">CORE_001</span>
                      <span role="cell">2026-06-12</span>
                      <span role="cell">92.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">NEW_001</span>
                      <span role="cell">2026-06-19</span>
                      <span role="cell">42.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">RISK_001</span>
                      <span role="cell">2026-04-23</span>
                      <span role="cell">260.00</span>
                    </div>
                    <div className="sample-format-row" role="row">
                      <span role="cell">SLEEP_001</span>
                      <span role="cell">2026-01-10</span>
                      <span role="cell">310.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
