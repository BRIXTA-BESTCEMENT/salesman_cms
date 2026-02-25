// src/components/data-comparison-calculation.tsx

import { useEffect, useMemo, useState, useCallback } from 'react';
import { z } from 'zod';
import { 
  selectDailyVisitReportSchema, 
  selectTechnicalVisitReportSchema, 
  selectSalesOrderSchema, 
  selectPermanentJourneyPlanSchema
} from '../../drizzle/zodSchemas';

/* =========================
   Extended Schemas
========================= */
// Add missing joined fields, aliases, and coercions for calculations
const extendedPjpSchema = selectPermanentJourneyPlanSchema.extend({
  status: z.string().optional().catch(''),
  verificationStatus: z.string().nullable().optional(),
});

const extendedDvrSchema = selectDailyVisitReportSchema.extend({
  role: z.string().optional().catch(''),
});

const extendedSalesSchema = selectSalesOrderSchema.extend({
  // Crucial: coerce orderTotal so calculations don't fail, as it's a computed field
  orderTotal: z.coerce.number().optional().catch(0),
  dealerType: z.string().nullable().optional(),
});

const extendedTvrSchema = selectTechnicalVisitReportSchema.extend({
  role: z.string().optional().catch(''),
  // Add alias fallback for 'date' vs Drizzle's 'reportDate'
  date: z.string().optional(),
});


/* =========================
   Types (from extended schemas)
========================= */
export type PJPRecord = z.infer<typeof extendedPjpSchema>;
export type DVRRecord = z.infer<typeof extendedDvrSchema>;
export type SalesRecord = z.infer<typeof extendedSalesSchema>;
export type TVRRecord = z.infer<typeof extendedTvrSchema>;

export interface MoMComparisonMetrics {
  metric: string;
  thisMonthValue: number;
  lastMonthValue: number;
  changePercentage: number;
}

export interface ComparisonAnalytics {
  targetAchievementPercentage: number;
  momMetrics: MoMComparisonMetrics[];
}

export interface DVRvPJPAnalytics {
  targetAchievementPercentage: number; // UI-friendly name
  momMetrics: MoMComparisonMetrics[];
}

/* =========================
   Pure calc helpers
========================= */
export function calculateTotalSalesValue(salesRecords: SalesRecord[]): number {
  return salesRecords.reduce((sum, r) => sum + (r.orderTotal ?? 0), 0);
}

export function calculateChange(thisValue: number, lastValue: number): number {
  if (lastValue === 0) return thisValue > 0 ? 100 : 0;
  return ((thisValue - lastValue) / lastValue) * 100;
}

export function filterByDateRange<
  T extends { reportDate?: string | null; planDate?: string | null; orderDate?: string | null; date?: string | null }
>(records: T[], days: number): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return records.filter(rec => {
    // Check multiple potential date keys
    const s = rec.reportDate ?? rec.planDate ?? rec.orderDate ?? rec.date;
    if (!s) return false;
    return new Date(s) >= cutoff;
  });
}

export function calculateDVRvPJPAnalytics(
  allDvrs: DVRRecord[],
  allPjps: PJPRecord[]
): DVRvPJPAnalytics {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const inThisMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };
  const inLastMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
  };

  const thisPJP = allPjps.filter(p => inThisMonth(p.planDate)).length;
  const lastPJP = allPjps.filter(p => inLastMonth(p.planDate)).length;

  const thisDVR = allDvrs.filter(d => inThisMonth(d.reportDate)).length;
  const lastDVR = allDvrs.filter(d => inLastMonth(d.reportDate)).length;

  const target = thisPJP > 0 ? (thisDVR / thisPJP) * 100 : 0;

  return {
    targetAchievementPercentage: Math.round(target * 100) / 100,
    momMetrics: [
      {
        metric: 'PJP Visits Planned',
        thisMonthValue: thisPJP,
        lastMonthValue: lastPJP,
        changePercentage: calculateChange(thisPJP, lastPJP),
      },
      {
        metric: 'Actual Visits (DVRs Completed)',
        thisMonthValue: thisDVR,
        lastMonthValue: lastDVR,
        changePercentage: calculateChange(thisDVR, lastDVR),
      },
    ],
  };
}

export function calculateTVRvPJPAnalytics(
  allTvrs: TVRRecord[],
  allPjps: PJPRecord[]
): ComparisonAnalytics {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const inThisMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };
  const inLastMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
  };

  const thisPJP = allPjps.filter(p => inThisMonth(p.planDate)).length;
  const lastPJP = allPjps.filter(p => inLastMonth(p.planDate)).length;

  // TVR might use alias 'date' or DB column 'reportDate'
  const thisTVR = allTvrs.filter(d => inThisMonth(d.date || d.reportDate)).length;
  const lastTVR = allTvrs.filter(d => inLastMonth(d.date || d.reportDate)).length;

  const target = thisPJP > 0 ? (thisTVR / thisPJP) * 100 : 0;

  return {
    targetAchievementPercentage: Math.round(target * 100) / 100,
    momMetrics: [
      {
        metric: 'PJP Visits Planned',
        thisMonthValue: thisPJP,
        lastMonthValue: lastPJP,
        changePercentage: calculateChange(thisPJP, lastPJP),
      },
      {
        metric: 'Actual Tech Visits (TVRs)',
        thisMonthValue: thisTVR,
        lastMonthValue: lastTVR,
        changePercentage: calculateChange(thisTVR, lastTVR),
      },
    ],
  };
}

/* ===== Sales vs DVR analytics (used by sales-dvr page) ===== */
export function calculateSalesvDVR_MoMComparison(
  allSales: SalesRecord[], allDvrs: DVRRecord[]
): MoMComparisonMetrics[] {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const inThisMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  };
  const inLastMonth = (s?: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
  };

  const thisMonthSales = allSales.filter(s => inThisMonth(s.orderDate));
  const lastMonthSales = allSales.filter(s => inLastMonth(s.orderDate));
  const thisMonthSalesValue = calculateTotalSalesValue(thisMonthSales);
  const lastMonthSalesValue = calculateTotalSalesValue(lastMonthSales);

  const thisMonthDvrs = allDvrs.filter(d => inThisMonth(d.reportDate)).length;
  const lastMonthDvrs = allDvrs.filter(d => inLastMonth(d.reportDate)).length;

  return [
    {
      metric: 'Total Sales Value (Rupees)',
      thisMonthValue: thisMonthSalesValue,
      lastMonthValue: lastMonthSalesValue,
      changePercentage: calculateChange(thisMonthSalesValue, lastMonthSalesValue),
    },
    {
      metric: 'Daily Visit Reports (DVR)',
      thisMonthValue: thisMonthDvrs,
      lastMonthValue: lastMonthDvrs,
      changePercentage: calculateChange(thisMonthDvrs, lastMonthDvrs),
    },
  ];
}

export interface SalesvDVRAnalytics {
  totalSalesValue: number;
  totalVisits: number;
  salesPerVisit: number;
  momMetrics: MoMComparisonMetrics[];
}

export function calculateSalesvDVRAnalytics(
  allSales: SalesRecord[], allDvrs: DVRRecord[]
): SalesvDVRAnalytics {
  const momMetrics = calculateSalesvDVR_MoMComparison(allSales, allDvrs);
  const totalSalesValue = calculateTotalSalesValue(allSales);
  const totalVisits = allDvrs.length;
  const salesPerVisit = totalVisits > 0 ? Math.round((totalSalesValue / totalVisits) * 100) / 100 : 0;
  return { totalSalesValue, totalVisits, salesPerVisit, momMetrics };
}

/* =========================
   Client fetch hook
========================= */

type UseDvrPjpResult = {
  loading: boolean;
  error: string | null;
  pjps: PJPRecord[] | null;         
  dvrs: DVRRecord[] | null;         
  sales: SalesRecord[] | null;      
  filteredPjps: PJPRecord[] | null; 
  filteredDvrs: DVRRecord[] | null;
  analytics: DVRvPJPAnalytics | null; 
  refetch: () => void;
};

export function useDvrPjpData(days = 30): UseDvrPjpResult {
  const [pjps, setPjps] = useState<PJPRecord[] | null>(null);
  const [dvrs, setDvrs] = useState<DVRRecord[] | null>(null);
  const [sales, setSales] = useState<SalesRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAll = useCallback(async (signal: AbortSignal) => {
    const base = `/api/dashboardPagesAPI`; 
    const ensureOk = async (name: string, r: Response) => {
      if (!r.ok) {
        let body: any = null;
        try { body = await r.json(); } catch { }
        throw new Error(`${name} failed [${r.status}]: ${body?.error ?? r.statusText}`);
      }
      return r.json();
    };

    const [pjpRes, dvrRes, salesRes] = await Promise.all([
      fetch(`${base}/permanent-journey-plan?verificationStatus=VERIFIED`, { credentials: 'include', cache: 'no-store', signal, headers: { accept: 'application/json' } }),
      fetch(`${base}/reports/daily-visit-reports`, { credentials: 'include', cache: 'no-store', signal, headers: { accept: 'application/json' } }),
      fetch(`${base}/reports/sales-orders`, { credentials: 'include', cache: 'no-store', signal, headers: { accept: 'application/json' } }),
    ]);

    const [pjpRaw, dvrRaw, salesRaw] = await Promise.all([
      ensureOk('PJP', pjpRes),
      ensureOk('DVR', dvrRes),
      ensureOk('Sales', salesRes),
    ]);

    // Use extended schemas for accurate parsing
    const pjpParsed = z.array(extendedPjpSchema).safeParse(pjpRaw);
    if (!pjpParsed.success) {
      const m = pjpParsed.error.issues?.[0]?.message ?? 'PJP validation failed';
      throw new Error(`PJP schema error: ${m}`);
    }
    const dvrParsed = z.array(extendedDvrSchema).safeParse(dvrRaw);
    if (!dvrParsed.success) {
      const m = dvrParsed.error.issues?.[0]?.message ?? 'DVR validation failed';
      throw new Error(`DVR schema error: ${m}`);
    }
    const salesParsed = z.array(extendedSalesSchema).safeParse(salesRaw);
    if (!salesParsed.success) {
      const m = salesParsed.error.issues?.[0]?.message ?? 'Sales validation failed';
      throw new Error(`Sales schema error: ${m}`);
    }

    const upper = (v?: string | null) => (v ?? '').toString().trim().toUpperCase();

    const pjpsClean: PJPRecord[] = pjpParsed.data.map(p => ({
      ...p,
      status: upper(p.status),
      verificationStatus: upper(p.verificationStatus) as PJPRecord['verificationStatus'],
    }));

    const dvrsClean: DVRRecord[] = dvrParsed.data.map(d => ({
      ...d,
      role: upper(d.role),
    }));

    const salesClean: SalesRecord[] = salesParsed.data.map(s => ({
      ...s,
      dealerType: upper(s.dealerType),
    }));

    return { pjpsClean, dvrsClean, salesClean };
  }, []);

  const refetch = useCallback(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchAll(ac.signal)
      .then(({ pjpsClean, dvrsClean, salesClean }) => {
        setPjps(pjpsClean);
        setDvrs(dvrsClean);
        setSales(salesClean);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setError(e?.message ?? 'Fetch failed');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [fetchAll]);

  useEffect(() => {
    const cancel = refetch();
    return cancel;
  }, [refetch]); // Added exhaustive deps

  const verifiedPjps = useMemo(
    () => (pjps ? pjps.filter(p => p.verificationStatus === 'VERIFIED') : null),
    [pjps]
  );

  const filteredPjps = useMemo(
    () => (verifiedPjps ? filterByDateRange(verifiedPjps, days) : null),
    [verifiedPjps, days]
  );

  const filteredDvrs = useMemo(
    () => (dvrs ? filterByDateRange(dvrs, days) : null),
    [dvrs, days]
  );

  const analytics = useMemo(
    () => (verifiedPjps && dvrs ? calculateDVRvPJPAnalytics(dvrs, verifiedPjps) : null),
    [verifiedPjps, dvrs]
  );

  return { loading, error, pjps, dvrs, sales, filteredPjps, filteredDvrs, analytics, refetch };
}

type UseTvrPjpResult = {
  loading: boolean;
  error: string | null;
  pjps: PJPRecord[] | null;
  tvrs: TVRRecord[] | null;
  filteredPjps: PJPRecord[] | null;
  filteredTvrs: TVRRecord[] | null;
  analytics: ComparisonAnalytics | null;
  refetch: () => void;
};

export function useTvrPjpData(days = 30): UseTvrPjpResult {
  const [pjps, setPjps] = useState<PJPRecord[] | null>(null);
  const [tvrs, setTvrs] = useState<TVRRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAll = useCallback(async (signal: AbortSignal) => {
    const base = `/api/dashboardPagesAPI`;
    const ensureOk = async (name: string, r: Response) => {
      if (!r.ok) {
        let body: any = null;
        try { body = await r.json(); } catch { }
        throw new Error(`${name} failed [${r.status}]: ${body?.error ?? r.statusText}`);
      }
      return r.json();
    };

    const [pjpRes, tvrRes] = await Promise.all([
      fetch(`${base}/permanent-journey-plan?verificationStatus=VERIFIED`, { credentials: 'include', cache: 'no-store', signal }),
      fetch(`${base}/reports/technical-visit-reports`, { credentials: 'include', cache: 'no-store', signal }),
    ]);

    const [pjpRaw, tvrRaw] = await Promise.all([
      ensureOk('PJP', pjpRes),
      ensureOk('TVR', tvrRes),
    ]);

    // Parse using the extended schemas
    const pjpParsed = z.array(extendedPjpSchema).safeParse(pjpRaw);
    if (!pjpParsed.success) throw new Error(`PJP Schema: ${pjpParsed.error.message}`);

    const tvrParsed = z.array(extendedTvrSchema).safeParse(tvrRaw);
    if (!tvrParsed.success) throw new Error(`TVR Schema: ${tvrParsed.error.message}`);

    const upper = (v?: string | null) => (v ?? '').toString().trim().toUpperCase();

    const pjpsClean = pjpParsed.data.map(p => ({
      ...p,
      status: upper(p.status),
      verificationStatus: upper(p.verificationStatus) as PJPRecord['verificationStatus'],
    }));

    const tvrsClean = tvrParsed.data.map(t => ({
      ...t,
      role: upper(t.role),
    }));

    return { pjpsClean, tvrsClean };
  }, []);

  const refetch = useCallback(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchAll(ac.signal)
      .then(({ pjpsClean, tvrsClean }) => {
        setPjps(pjpsClean);
        setTvrs(tvrsClean);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setError(e?.message ?? 'Fetch failed');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [fetchAll]);

  useEffect(() => { const c = refetch(); return c; }, [refetch]);

  const verifiedPjps = useMemo(() => (pjps ? pjps.filter(p => p.verificationStatus === 'VERIFIED') : null), [pjps]);
  const filteredPjps = useMemo(() => (verifiedPjps ? filterByDateRange(verifiedPjps, days) : null), [verifiedPjps, days]);
  
  const filteredTvrs = useMemo(() => (tvrs ? filterByDateRange(tvrs, days) : null), [tvrs, days]);

  const analytics = useMemo(
    () => (verifiedPjps && tvrs ? calculateTVRvPJPAnalytics(tvrs, verifiedPjps) : null),
    [verifiedPjps, tvrs]
  );

  return { loading, error, pjps, tvrs, filteredPjps, filteredTvrs, analytics, refetch };
}