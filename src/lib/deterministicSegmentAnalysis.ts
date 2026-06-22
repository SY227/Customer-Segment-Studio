import { SEGMENT_GUILD_DATA, type FrequencyBand, type RecencyBand, type SegmentBusinessUpdate, type SegmentKey } from "../data/segmentGuildData";

export interface NormalizedOrderRow {
  customer_uid: string;
  purchase_date: string;
  total: number;
}

interface CustomerAggregate {
  customerUid: string;
  orderCount: number;
  totalSpend: number;
  lastPurchaseMs: number;
}

interface SegmentAggregate {
  label: string;
  customerCount: number;
  segmentRevenue: number;
}

export interface DeterministicAnalysisResult {
  totalRevenue: number;
  totalCustomers: number;
  asOfDate: string;
  segments: SegmentBusinessUpdate[];
}

const KEY_TO_LABEL = new Map<SegmentKey, string>(SEGMENT_GUILD_DATA.map((segment) => [segment.key, segment.label]));

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toUtcDayMs(input: string) {
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function createScoreGetter(values: number[], higherIsBetter: boolean) {
  if (!values.length) {
    return () => 2 as const;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (min === max) {
    return () => 2 as const;
  }

  const lowThreshold = sorted[Math.floor((sorted.length - 1) / 3)];
  const highThreshold = sorted[Math.floor(((sorted.length - 1) * 2) / 3)];

  return (value: number) => {
    if (higherIsBetter) {
      if (value <= lowThreshold) return 1 as const;
      if (value <= highThreshold) return 2 as const;
      return 3 as const;
    }

    if (value <= lowThreshold) return 3 as const;
    if (value <= highThreshold) return 2 as const;
    return 1 as const;
  };
}

function recencyBandFromScore(score: 1 | 2 | 3): RecencyBand {
  if (score === 3) return "Recent";
  if (score === 2) return "Not Recent";
  return "Dormant";
}

function frequencyBandFromScores(frequencyScore: 1 | 2 | 3, monetaryScore: 1 | 2 | 3): FrequencyBand {
  const combined = frequencyScore + monetaryScore;
  if (combined >= 5) return "High Frequency";
  if (combined >= 3) return "Medium Frequency";
  return "Low Frequency";
}

export function analyzeOrdersDeterministically(rows: NormalizedOrderRow[]): DeterministicAnalysisResult {
  const customerMap = new Map<string, CustomerAggregate>();
  let totalRevenue = 0;
  let asOfMs = Number.NEGATIVE_INFINITY;

  rows.forEach((row) => {
    const customerUid = row.customer_uid.trim();
    const purchaseMs = toUtcDayMs(row.purchase_date);
    const total = Number(row.total);

    if (!customerUid || purchaseMs === null || !Number.isFinite(total)) {
      return;
    }

    totalRevenue += total;
    asOfMs = Math.max(asOfMs, purchaseMs);

    const aggregate = customerMap.get(customerUid) ?? {
      customerUid,
      orderCount: 0,
      totalSpend: 0,
      lastPurchaseMs: purchaseMs,
    };

    aggregate.orderCount += 1;
    aggregate.totalSpend += total;
    aggregate.lastPurchaseMs = Math.max(aggregate.lastPurchaseMs, purchaseMs);
    customerMap.set(customerUid, aggregate);
  });

  const customers = [...customerMap.values()];

  if (!customers.length || !Number.isFinite(asOfMs)) {
    throw new Error("The dataset must include valid customer_uid, purchase_date, and total values.");
  }

  const recencyDays = customers.map((customer) => round((asOfMs - customer.lastPurchaseMs) / 86_400_000, 4));
  const orderCounts = customers.map((customer) => customer.orderCount);
  const totalSpends = customers.map((customer) => round(customer.totalSpend, 4));

  const getRecencyScore = createScoreGetter(recencyDays, false);
  const getFrequencyScore = createScoreGetter(orderCounts, true);
  const getMonetaryScore = createScoreGetter(totalSpends, true);

  const segmentAggregates = new Map<string, SegmentAggregate>(
    SEGMENT_GUILD_DATA.map((segment) => [segment.label, { label: segment.label, customerCount: 0, segmentRevenue: 0 }]),
  );

  customers.forEach((customer) => {
    const recencyScore = getRecencyScore(round((asOfMs - customer.lastPurchaseMs) / 86_400_000, 4));
    const frequencyScore = getFrequencyScore(customer.orderCount);
    const monetaryScore = getMonetaryScore(round(customer.totalSpend, 4));
    const recencyBand = recencyBandFromScore(recencyScore);
    const frequencyBand = frequencyBandFromScores(frequencyScore, monetaryScore);
    const key = `${recencyBand}|${frequencyBand}` as SegmentKey;
    const label = KEY_TO_LABEL.get(key);

    if (!label) return;

    const aggregate = segmentAggregates.get(label);
    if (!aggregate) return;

    aggregate.customerCount += 1;
    aggregate.segmentRevenue += customer.totalSpend;
  });

  const normalizedTotalRevenue = round(totalRevenue, 2);
  const segments: SegmentBusinessUpdate[] = SEGMENT_GUILD_DATA.map((segment) => {
    const aggregate = segmentAggregates.get(segment.label);
    const segmentRevenue = aggregate ? aggregate.segmentRevenue : 0;
    const revenueShare = normalizedTotalRevenue > 0 ? round(segmentRevenue / normalizedTotalRevenue, 6) : 0;

    return {
      label: segment.label,
      customerCount: aggregate?.customerCount ?? 0,
      revenueShare,
    };
  });

  return {
    totalRevenue: normalizedTotalRevenue,
    totalCustomers: customers.length,
    asOfDate: new Date(asOfMs).toISOString().slice(0, 10),
    segments,
  };
}
