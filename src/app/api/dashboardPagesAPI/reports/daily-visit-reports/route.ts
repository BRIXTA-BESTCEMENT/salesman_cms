// src/app/api/dashboardPagesAPI/routes/daily-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dailyVisitReports, dealers, dailyTasks } from '../../../../../../drizzle';
import { sql, eq, desc, and, or, ilike, aliasedTable, getTableColumns, count, SQL, isNull, notIlike, gte, lte } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyVisitReportSchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';
import { MEGHALAYA_OVERSEER_ID } from '@/lib/Reusable-constants';

const frontendDVRSchema = selectDailyVisitReportSchema.extend({
  id: z.string(),
  salesmanName: z.string(),
  area: z.string(),
  region: z.string(),
  dealerName: z.string().nullable().optional(),
  subDealerName: z.string().nullable().optional(),

  customerType: z.string().nullable().optional(),
  partyType: z.string().nullable().optional(),
  nameOfParty: z.string().nullable().optional(),
  contactNoOfParty: z.string().nullable().optional(),
  expectedActivationDate: z.string().nullable().optional(),

  latitude: z.number(),
  longitude: z.number(),
  dealerTotalPotential: z.number(),
  dealerBestPotential: z.number(),
  todayOrderMt: z.number(),
  todayCollectionRupees: z.number(),
  overdueAmount: z.number().nullable(),

  reportDate: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pjpStatus: z.string().nullable().optional(),
});

type DVRRow = InferSelectModel<typeof dailyVisitReports> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userArea: string | null;
  userRegion: string | null;
  dealerNameStr: string | null;
  subDealerNameStr: string | null;
  pjpTaskStatus: string | null;
  pjpVisitType: string | null;
};

async function getCachedDailyVisitReports(
  companyId: number,
  userId: number,
  page: number,
  pageSize: number,
  search: string | null,
  area: string | null,
  region: string | null,
  pjpStatus: string | null,
  startDate: string | null, 
  endDate: string | null    
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`daily-visit-reports-${companyId}`);

  // Unique cache tag based on active filters
  const filterKey = `${search}-${area}-${region}-${startDate}-${endDate}-${pjpStatus}`;
  cacheTag(`daily-visit-reports-${companyId}-${page}-${filterKey}`);

  const subDealers = aliasedTable(dealers, 'subDealers');

  const filters: (SQL | undefined)[] = [eq(users.companyId, companyId)];

  if (userId === MEGHALAYA_OVERSEER_ID) {
        filters.push(eq(users.region, 'Meghalaya'));
  }

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(dealers.name, `%${search}%`),
      ilike(subDealers.name, `%${search}%`),
      ilike(dailyVisitReports.nameOfParty, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (area) filters.push(eq(users.area, area));
  if (region) filters.push(eq(users.region, region));

  if (startDate) filters.push(gte(dailyVisitReports.reportDate, startDate));
  if (endDate) filters.push(lte(dailyVisitReports.reportDate, endDate));

  if (pjpStatus && pjpStatus !== 'all') {
    if (pjpStatus.toLowerCase() === 'unplanned') {
      filters.push(
        or(
          isNull(dailyTasks.id),
          ilike(dailyTasks.visitType, 'unplanned')
        )
      );
    } else {
      filters.push(
        and(
          ilike(dailyTasks.status, pjpStatus),
          or(isNull(dailyTasks.visitType), notIlike(dailyTasks.visitType, 'unplanned'))
        )
      );
    }
  }

  const whereClause = and(...filters);

  const results: DVRRow[] = await db
    .select({
      ...getTableColumns(dailyVisitReports),
      userFirstName: sql<string>`MAX(${users.firstName})`,
    userLastName: sql<string>`MAX(${users.lastName})`,
    userEmail: sql<string>`MAX(${users.email})`,
    userArea: sql<string>`MAX(${users.area})`,
    userRegion: sql<string>`MAX(${users.region})`,
    dealerNameStr: sql<string>`MAX(${dealers.name})`,
    subDealerNameStr: sql<string>`MAX(${subDealers.name})`,
    pjpTaskStatus: sql<string>`MAX(${dailyTasks.status})`,
    pjpVisitType: sql<string>`MAX(${dailyTasks.visitType})`,
    })
    .from(dailyVisitReports)
    .leftJoin(
      dailyTasks,
      and(
        eq(dailyVisitReports.userId, dailyTasks.userId),
        eq(dailyVisitReports.reportDate, dailyTasks.taskDate),
        eq(dailyVisitReports.dealerId, dailyTasks.dealerId)
      )
    )
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(whereClause)
    .groupBy(dailyVisitReports.id)
    .orderBy(desc(dailyVisitReports.reportDate))
    .limit(pageSize)
    .offset(page * pageSize);

  // Total count for pagination
  const totalCountResult = await db
    .select({ count: count() })
    .from(dailyVisitReports)
    .leftJoin(
      dailyTasks,
      and(
        eq(dailyVisitReports.userId, dailyTasks.userId),
        eq(dailyVisitReports.reportDate, dailyTasks.taskDate),
        eq(dailyVisitReports.dealerId, dailyTasks.dealerId)
      )
    )
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  // Format only the unique rows
  const formatted = Array.from(results.values()).map((row) => {
    const toNum = (v: any) => (v == null ? null : Number(v));
    const salesmanName = `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'Unknown';

    const finalPjpStatus = (!row.pjpTaskStatus || row.pjpVisitType?.toLowerCase() === 'unplanned')
      ? 'Unplanned'
      : row.pjpTaskStatus;

    return {
      ...row,
      id: String(row.id),
      salesmanName: salesmanName,
      area: row.userArea || '',
      region: row.userRegion || '',
      reportDate: row.reportDate ? new Date(row.reportDate).toISOString().split('T')[0] : '',
      dealerName: row.dealerNameStr ?? null,
      subDealerName: row.subDealerNameStr ?? null,
      pjpStatus: finalPjpStatus,

      customerType: row.customerType ?? null,
      partyType: row.partyType ?? null,
      nameOfParty: row.nameOfParty ?? null,
      contactNoOfParty: row.contactNoOfParty ?? null,
      expectedActivationDate: row.expectedActivationDate ? new Date(row.expectedActivationDate).toISOString().split('T')[0] : null,

      latitude: toNum(row.latitude) ?? 0,
      longitude: toNum(row.longitude) ?? 0,
      dealerTotalPotential: toNum(row.dealerTotalPotential) ?? 0,
      dealerBestPotential: toNum(row.dealerBestPotential) ?? 0,
      todayOrderMt: toNum(row.todayOrderMt) ?? 0,
      todayCollectionRupees: toNum(row.todayCollectionRupees) ?? 0,
      overdueAmount: toNum(row.overdueAmount),

      checkInTime: row.checkInTime ? new Date(row.checkInTime).toISOString() : '',
      checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  return { data: formatted, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes("READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    // Hard cap at 500
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const pjpStatus = searchParams.get('pjpStatus');

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedDailyVisitReports(
      session.companyId,
      session.userId,
      page,
      pageSize,
      search,
      area,
      region,
      pjpStatus,
      startDate,
      endDate
    );

    const validatedReports = z.array(frontendDVRSchema).safeParse(result.data);

    if (!validatedReports.success) {
      console.error('DVR Validation Error:', validatedReports.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 });
    }

    return NextResponse.json({
      data: validatedReports.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching daily visit reports:', error);
    return NextResponse.json({
      error: 'Failed to fetch daily visit reports',
      details: (error as Error).message
    }, { status: 500 });
  }
}