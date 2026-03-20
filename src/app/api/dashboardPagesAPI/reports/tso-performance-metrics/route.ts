// src/app/api/dashboardPagesAPI/reports/tso-performance-metrics/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, technicalVisitReports, tsoMeetings } from '../../../../../../drizzle';
import { eq, desc, and, or, ilike, SQL, sql, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { TSO_AOP_TARGETS } from '@/lib/Reusable-constants';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

// Reusable schema for the metric nodes
const metricNode = z.object({
  aop: z.number(),
  mtd: z.number(),
  pct: z.number(),
});

// Custom Zod schema for the aggregated metrics
const tsoPerformanceMetricSchema = z.object({
  userId: z.number().nullable(),
  salesmanName: z.string(),
  region: z.string().nullable(),
  area: z.string().nullable(),
  totalVisits: z.number(),
  metrics: z.object({
    siteVisitNew: metricNode,
    siteVisitOld: metricNode,
    dealerRetailer: metricNode,
    siteConversion: metricNode,
    volumeConvertedMT: metricNode,
    influencerVisits: metricNode,
    enrollmentLifting: metricNode,
    siteServiceSlab: metricNode,
    technicalMeet: metricNode,
  })
});

async function getCachedTsoPerformanceMetrics(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  area: string | null,
  region: string | null,
  startDate: string | null,
  endDate: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`tso-performance-metrics-${companyId}`);

  const filterKey = `${search}-${area}-${region}-${startDate}-${endDate}`;
  cacheTag(`tso-performance-metrics-${companyId}-${page}-${filterKey}`);

  // --- BUILD THE MEETINGS SUBQUERY ---
  const meetingFilters: (SQL | undefined)[] = [];
  if (startDate) meetingFilters.push(gte(tsoMeetings.date, startDate));
  if (endDate) {
    const endOfDay = new Date(endDate);
    const endStr = endOfDay.toISOString().split('T')[0]; // Extract YYYY-MM-DD for date() column
    meetingFilters.push(lte(tsoMeetings.date, endStr));
  }

  // This isolates the count so it doesn't multiply the TVR rows
  const meetingsSq = db
    .select({
      userId: tsoMeetings.createdByUserId,
      meetCount: sql<number>`CAST(COUNT(${tsoMeetings.id}) AS INTEGER)`.as('meet_count'),
    })
    .from(tsoMeetings)
    .where(meetingFilters.length > 0 ? and(...meetingFilters) : undefined)
    .groupBy(tsoMeetings.createdByUserId)
    .as('meetings_sq');
  // --------------------------------------

  const filters: (SQL | undefined)[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(users.area, `%${search}%`),
      ilike(users.region, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (area) filters.push(eq(users.area, area));
  if (region) filters.push(eq(users.region, region));
  
  if (startDate) {
    filters.push(gte(technicalVisitReports.reportDate, startDate));
  }
  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    filters.push(lte(technicalVisitReports.reportDate, endOfDay.toISOString()));
  }

  const whereClause = and(...filters);

  // Group by User to aggregate metric counts per TSO
  const rawResults = await db
    .select({
      userId: users.id,
      salesmanName: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${users.firstName}, ' ', ${users.lastName})), ''), ${users.email})`,
      region: users.region,
      area: users.area,
      totalVisits: sql<number>`CAST(COUNT(${technicalVisitReports.id}) AS INTEGER)`,
      
      // Categorizing based on specific metrics
      siteVisitsNew: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.customerType} ILIKE '%Site%' AND ${technicalVisitReports.visitCategory} ILIKE '%New%' THEN 1 ELSE 0 END) AS INTEGER)`,
      siteVisitsOld: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.customerType} ILIKE '%Site%' AND ${technicalVisitReports.visitCategory} ILIKE '%Follow Up%' THEN 1 ELSE 0 END) AS INTEGER)`,
      dealerVisits: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.customerType} ILIKE '%Dealer%' THEN 1 ELSE 0 END) AS INTEGER)`,
      siteConversion: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.isConverted} = true THEN 1 ELSE 0 END) AS INTEGER)`,
      volumeConverted: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.isConverted} = true THEN ${technicalVisitReports.conversionQuantityValue} ELSE 0 END) AS NUMERIC)`,
      influencerVisits: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.customerType} ILIKE '%Influencer%' OR ${technicalVisitReports.customerType} ILIKE '%Architect%' THEN 1 ELSE 0 END) AS INTEGER)`,
      enrollmentLifting: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.isSchemeEnrolled} = true THEN 1 ELSE 0 END) AS INTEGER)`,
      siteServiceSlab: sql<number>`CAST(SUM(CASE WHEN ${technicalVisitReports.isTechService} = true AND ${technicalVisitReports.serviceType} ILIKE '%Slab%' THEN 1 ELSE 0 END) AS INTEGER)`,
      // PULL FROM THE ATTACHED SUBQUERY
      technicalMeet: sql<number>`CAST(COALESCE(MAX(${meetingsSq.meetCount}), 0) AS INTEGER)`,
    })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .leftJoin(meetingsSq, eq(users.id, meetingsSq.userId))
    .where(whereClause)
    .groupBy(users.id, users.firstName, users.lastName, users.email, users.region, users.area)
    .orderBy(desc(sql`COUNT(${technicalVisitReports.id})`))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountQuery = await db
    .select({ userId: users.id })
    .from(technicalVisitReports)
    .leftJoin(users, eq(technicalVisitReports.userId, users.id))
    .where(whereClause)
    .groupBy(users.id);
    
  const totalCount = totalCountQuery.length;

  const calcPct = (mtd: number, aop: number) => aop > 0 ? Math.round((mtd / aop) * 100) : 0;

  const results = rawResults.map((r) => ({
    userId: r.userId,
    salesmanName: r.salesmanName,
    region: r.region,
    area: r.area,
    totalVisits: r.totalVisits,
    metrics: {
      siteVisitNew: { aop: TSO_AOP_TARGETS.siteVisitNew, mtd: r.siteVisitsNew || 0, pct: calcPct(r.siteVisitsNew || 0, TSO_AOP_TARGETS.siteVisitNew) },
      siteVisitOld: { aop: TSO_AOP_TARGETS.siteVisitOld, mtd: r.siteVisitsOld || 0, pct: calcPct(r.siteVisitsOld || 0, TSO_AOP_TARGETS.siteVisitOld) },
      dealerRetailer: { aop: TSO_AOP_TARGETS.dealerRetailer, mtd: r.dealerVisits || 0, pct: calcPct(r.dealerVisits || 0, TSO_AOP_TARGETS.dealerRetailer) },
      siteConversion: { aop: TSO_AOP_TARGETS.siteConversion, mtd: r.siteConversion || 0, pct: calcPct(r.siteConversion || 0, TSO_AOP_TARGETS.siteConversion) },
      volumeConvertedMT: { aop: TSO_AOP_TARGETS.volumeConvertedMT, mtd: Number(r.volumeConverted) || 0, pct: calcPct(Number(r.volumeConverted) || 0, TSO_AOP_TARGETS.volumeConvertedMT) },
      influencerVisits: { aop: TSO_AOP_TARGETS.influencerVisits, mtd: r.influencerVisits || 0, pct: calcPct(r.influencerVisits || 0, TSO_AOP_TARGETS.influencerVisits) },
      enrollmentLifting: { aop: TSO_AOP_TARGETS.enrollmentLifting, mtd: r.enrollmentLifting || 0, pct: calcPct(r.enrollmentLifting || 0, TSO_AOP_TARGETS.enrollmentLifting) },
      siteServiceSlab: { aop: TSO_AOP_TARGETS.siteServiceSlab, mtd: r.siteServiceSlab || 0, pct: calcPct(r.siteServiceSlab || 0, TSO_AOP_TARGETS.siteServiceSlab) },
      technicalMeet: { aop: TSO_AOP_TARGETS.technicalMeet, mtd: r.technicalMeet || 0, pct: calcPct(r.technicalMeet || 0, TSO_AOP_TARGETS.technicalMeet) },
    }
  }));

  return { data: results, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];
    if (!currentUser || !allowedRoles.includes(currentUser.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 100), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedTsoPerformanceMetrics(
      currentUser.companyId, page, pageSize, search, area, region, startDate, endDate
    );

    const validated = z.array(tsoPerformanceMetricSchema).safeParse(result.data);

    return NextResponse.json({
      data: validated.success ? validated.data : result.data,
      totalCount: result.totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to fetch TSO performance metrics', error: (error as Error).message },
      { status: 500 }
    );
  }
}