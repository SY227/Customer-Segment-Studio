import { NextResponse } from "next/server";

import { SEGMENT_LABELS } from "@/data/segmentGuildData";

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

async function decodeUploadToCsv(fileBase64: string, mimeType = "", fileName = "") {
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
    if (!firstSheetName) throw new Error("Excel file has no sheets.");
    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_csv(sheet);
  }

  return buffer.toString("utf8");
}

function extractTextFromGeminiResponse(payload: any) {
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

function buildPrompt(csvText: string, sourceLabel: string) {
  return `Return JSON only for a customer segmentation dashboard.

Use these exact 9 segment labels once each:
${SEGMENT_LABELS.join(", ")}

Input columns:
- customer_uid
- purchase_date
- total

Requirements:
- objective must be one of: defend margin, upsell, retain, reactivate, deprioritize
- revenueShare must be decimal 0 to 1
- customerCount must be integer
- keep all text concise and executive-readable

Return this shape:
{
  "sourceLabel": "${sourceLabel}",
  "totalRevenue": 0,
  "segments": [
    {
      "label": "Best Customers",
      "customerCount": 0,
      "revenueShare": 0,
      "bestChannel": "",
      "kpi": "",
      "objective": "defend margin",
      "actionPreview": "",
      "messagingAngle": "",
      "sampleTactic": "",
      "interpretation": "",
      "timeHorizon": "",
      "offerIntensity": "",
      "speechBubble": ""
    }
  ]
}

Raw order data:
${csvText}`;
}

function validateResponse(data: any) {
  if (!data || !Array.isArray(data.segments)) throw new Error("The analysis engine returned an incomplete result.");
  const labels = new Set(data.segments.map((segment: any) => segment?.label));
  for (const label of SEGMENT_LABELS) {
    if (!labels.has(label)) throw new Error("The analysis engine returned an incomplete result.");
  }
  return {
    sourceLabel: String(data.sourceLabel ?? "Processed dataset"),
    totalRevenue: typeof data.totalRevenue === "number" ? Math.max(0, data.totalRevenue) : 0,
    segments: data.segments,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGeminiWithRetry(apiKey: string, csvText: string, sourceLabel: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(csvText, sourceLabel) }],
            },
          ],
        }),
      });

      if (!response.ok) {
        await response.text();
        throw new Error("The analysis engine could not process this dataset. Please try again.");
      }

      const geminiPayload = await response.json();
      const jsonText = extractTextFromGeminiResponse(geminiPayload);
      const parsed = extractJson(jsonText);
      return validateResponse(parsed);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(800 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Data processing failed. Please try again.");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Data processing is not configured. Add your API key to .env.local and restart the app." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as RequestPayload;
    const sourceLabel = body.mode === "sample" ? "Sample dataset" : `Uploaded dataset${body.fileName ? `: ${body.fileName}` : ""}`;
    const csvText =
      body.mode === "sample"
        ? SAMPLE_ORDERS_CSV
        : await decodeUploadToCsv(body.fileBase64 ?? "", body.mimeType ?? "", body.fileName ?? "");

    const validated = await runGeminiWithRetry(apiKey, csvText, sourceLabel);

    return NextResponse.json(validated);
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
