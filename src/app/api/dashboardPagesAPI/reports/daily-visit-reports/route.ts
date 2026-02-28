// src/app/api/dashboardPagesAPI/routes/daily-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dailyVisitReports, dealers } from '../../../../../../drizzle';
import { eq, desc, and, or, ilike, aliasedTable, getTableColumns, count, SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod'; 
import { selectDailyVisitReportSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive'
];

const frontendDVRSchema = selectDailyVisitReportSchema.extend({
  id: z.string(), 
  salesmanName: z.string(),
  role: z.string(),
  area: z.string(),
  region: z.string(),
  dealerName: z.string().nullable().optional(),
  subDealerName: z.string().nullable().optional(),
  
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
});

type DVRRow = InferSelectModel<typeof dailyVisitReports> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
  dealerNameStr: string | null;
  subDealerNameStr: string | null;
};

async function getCachedDailyVisitReports(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  role: string | null,
  area: string | null,
  region: string | null
) {
  'use cache';
  cacheLife('hours');
  
  // Unique cache tag based on active filters
  const filterKey = `${search}-${role}-${area}-${region}`;
  cacheTag(`daily-visit-reports-${companyId}-${page}-${filterKey}`);

  const subDealers = aliasedTable(dealers, 'subDealers');

  // Strictly type as SQL[] to prevent undefined errors in and()
  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(dealers.name, `%${search}%`),
      ilike(subDealers.name, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }
  
  if (role) filters.push(eq(users.role, role));
  if (area) filters.push(eq(users.area, area));
  if (region) filters.push(eq(users.region, region));

  const whereClause = and(...filters);

  const results: DVRRow[] = await db
    .select({
      ...getTableColumns(dailyVisitReports),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
      userArea: users.area,
      userRegion: users.region,
      dealerNameStr: dealers.name,
      subDealerNameStr: subDealers.name,
    })
    .from(dailyVisitReports)
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(whereClause)
    .orderBy(desc(dailyVisitReports.reportDate))
    .limit(pageSize)
    .offset(page * pageSize);

  // Total count for pagination
  const totalCountResult = await db
    .select({ count: count() })
    .from(dailyVisitReports)
    .leftJoin(users, eq(dailyVisitReports.userId, users.id))
    .leftJoin(dealers, eq(dailyVisitReports.dealerId, dealers.id))
    .leftJoin(subDealers, eq(dailyVisitReports.subDealerId, subDealers.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formatted = results.map((row) => {
    const toNum = (v: any) => (v == null ? null : Number(v));
    const salesmanName = `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'Unknown';

    return {
      ...row,
      id: String(row.id),
      salesmanName: salesmanName,
      role: row.userRole || 'Unknown',
      area: row.userArea || '',
      region: row.userRegion || '',
      reportDate: row.reportDate ? new Date(row.reportDate).toISOString().split('T')[0] : '',
      dealerName: row.dealerNameStr ?? null,
      subDealerName: row.subDealerNameStr ?? null,
      
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
    const claims = await getTokenClaims();

    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    // Hard cap at 500
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const area = searchParams.get('area');
    const region = searchParams.get('region');

    const result = await getCachedDailyVisitReports(
      currentUser.companyId,
      page,
      pageSize,
      search,
      role,
      area,
      region
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