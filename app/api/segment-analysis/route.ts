import { NextResponse } from "next/server";

import { SEGMENT_LABELS, type SegmentBusinessUpdate } from "@/data/segmentGuildData";
import { analyzeOrdersDeterministically, type NormalizedOrderRow } from "@/lib/deterministicSegmentAnalysis";

export const runtime = "nodejs";

type RequestPayload =
  | { mode: "sample" }
  | { mode: "upload"; fileName?: string; mimeType?: string; fileBase64?: string };

const SAMPLE_ORDERS_CSV = `customer_uid,purchase_date,total
VIP_001,2026-06-20,240.00
VIP_001,2026-06-10,195.00
VIP_001,2026-05-29,210.00
VIP_002,2026-06-18,180.00
VIP_002,2026-06-03,165.00
VIP_003,2026-06-16,150.00
CORE_001,2026-06-12,92.00
CORE_001,2026-05-31,88.00
CORE_001,2026-05-10,84.00
CORE_002,2026-06-09,76.00
CORE_002,2026-05-24,82.00
CORE_003,2026-06-05,68.00
NEW_001,2026-06-19,42.00
NEW_002,2026-06-18,58.00
NEW_003,2026-06-17,35.00
RISK_001,2026-04-23,260.00
RISK_001,2026-03-28,230.00
RISK_002,2026-04-10,205.00
WARM_001,2026-05-07,72.00
WARM_001,2026-04-08,69.00
DRIFT_001,2026-03-15,54.00
DRIFT_002,2026-02-26,49.00
SLEEP_001,2026-01-10,310.00
SLEEP_001,2025-12-03,280.00
COLD_001,2026-02-03,86.00
COLD_001,2025-11-26,78.00
TAIL_001,2025-09-12,33.00
TAIL_002,2025-08-03,28.00
TAIL_003,2025-10-15,24.00`;

const SOFT_FIELDS = [
  "bestChannel",
  "kpi",
  "objective",
  "actionPreview",
  "messagingAngle",
  "sampleTactic",
  "interpretation",
  "timeHorizon",
  "offerIntensity",
  "speechBubble",
] as const;

type SoftField = (typeof SOFT_FIELDS)[number];
type SoftGuidanceUpdate = Pick<SegmentBusinessUpdate, "label"> & Partial<Record<SoftField, string>>;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumericTotal(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/[$,\s]/g, "");
  return Number(cleaned);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeRecords(records: Record<string, unknown>[]) {
  return records
    .map((record) => {
      const normalized = Object.fromEntries(
        Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]),
      ) as Record<string, unknown>;

      const customer_uid = String(normalized.customeruid ?? "").trim();
      const purchase_date = String(normalized.purchasedate ?? "").trim();
      const total = parseNumericTotal(normalized.total);

      return { customer_uid, purchase_date, total } satisfies NormalizedOrderRow;
    })
    .filter((row) => row.customer_uid && row.purchase_date && Number.isFinite(row.total));
}

function parseOrdersFromCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((value) => normalizeHeader(value));

  return normalizeRecords(
    dataRows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
    ),
  );
}

async function decodeUploadToRows(fileBase64: string, mimeType = "", fileName = "") {
  const buffer = Buffer.from(fileBase64, "base64");
  const lowerName = fileName.toLowerCase();
  const isExcel =
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("The uploaded spreadsheet does not contain a readable first tab.");
    }
    const sheet = workbook.Sheets[firstSheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return normalizeRecords(records);
  }

  return parseOrdersFromCsv(buffer.toString("utf8"));
}

function extractTextFromProviderResponse(payload: any) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => part?.text ?? "").join("\n");
}

function extractJson(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The analysis engine returned an unexpected format.");
  return JSON.parse(match[0]);
}

function buildSoftGuidancePrompt(sourceLabel: string, totalRevenue: number, segments: SegmentBusinessUpdate[]) {
  return `Return JSON only for soft customer-segmentation guidance.

Hard metrics are already calculated and must not be changed.
Do not add or modify customerCount, revenueShare, totalRevenue, segmentRevenue, sourceLabel, or labels.
Only provide these soft fields for each label when useful:
${SOFT_FIELDS.join(", ")}

Use these exact segment labels once each:
${SEGMENT_LABELS.join(", ")}

Dataset: ${sourceLabel}
Total revenue: ${totalRevenue}

Segment hard metrics:
${segments
  .map((segment) => `- ${segment.label}: customerCount=${segment.customerCount ?? 0}, revenueShare=${segment.revenueShare ?? 0}`)
  .join("\n")}

Return this shape:
{
  "segments": [
    {
      "label": "Best Customers",
      "bestChannel": "",
      "kpi": "",
      "objective": "",
      "actionPreview": "",
      "messagingAngle": "",
      "sampleTactic": "",
      "interpretation": "",
      "timeHorizon": "",
      "offerIntensity": "",
      "speechBubble": ""
    }
  ]
}`;
}

function sanitizeSoftGuidance(payload: any) {
  const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];

  return rawSegments
    .map((segment: any) => {
      const label = typeof segment?.label === "string" ? segment.label.trim() : "";
      if (!SEGMENT_LABELS.includes(label)) return null;

      const update: SoftGuidanceUpdate = { label };
      SOFT_FIELDS.forEach((field) => {
        if (typeof segment?.[field] === "string" && segment[field].trim()) {
          update[field] = segment[field].trim();
        }
      });
      return update;
    })
    .filter((segment: SoftGuidanceUpdate | null): segment is SoftGuidanceUpdate => Boolean(segment));
}

async function runSoftGuidanceWithRetry(apiKey: string, sourceLabel: string, totalRevenue: number, segments: SegmentBusinessUpdate[]) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildSoftGuidancePrompt(sourceLabel, totalRevenue, segments) }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        await response.text();
        throw new Error("The analysis engine could not process this dataset. Please try again.");
      }

      const providerPayload = await response.json();
      const jsonText = extractTextFromProviderResponse(providerPayload);
      return sanitizeSoftGuidance(extractJson(jsonText));
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Data processing failed. Please try again.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestPayload;
    const sourceLabel = body.mode === "sample" ? "Sample dataset" : `Uploaded dataset${body.fileName ? `: ${body.fileName}` : ""}`;
    const rows =
      body.mode === "sample"
        ? parseOrdersFromCsv(SAMPLE_ORDERS_CSV)
        : await decodeUploadToRows(body.fileBase64 ?? "", body.mimeType ?? "", body.fileName ?? "");

    const deterministic = analyzeOrdersDeterministically(rows);
    const apiKey = process.env.GEMINI_API_KEY;
    let softGuidance: SoftGuidanceUpdate[] = [];

    if (apiKey) {
      try {
        softGuidance = await runSoftGuidanceWithRetry(apiKey, sourceLabel, deterministic.totalRevenue, deterministic.segments);
      } catch {
        softGuidance = [];
      }
    }

    const softByLabel = new Map(softGuidance.map((segment) => [segment.label, segment]));
    const mergedSegments = deterministic.segments.map((segment) => ({
      ...segment,
      ...(softByLabel.get(segment.label) ?? {}),
    }));

    return NextResponse.json({
      sourceLabel,
      totalRevenue: deterministic.totalRevenue,
      segments: mergedSegments,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Data processing timed out. Please try again."
        : error instanceof Error
          ? error.message
          : "Data processing failed. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
