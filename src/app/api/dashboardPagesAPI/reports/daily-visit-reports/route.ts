// src/app/api/dashboardPagesAPI/routes/daily-visit-reports/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dailyVisitReports, dealers } from '../../../../../../drizzle';
import { eq, desc, and, aliasedTable, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod'; 
import { selectDailyVisitReportSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive'
];

// 1. Extend the baked DB schema to strictly type the joined and formatted fields
const frontendDVRSchema = selectDailyVisitReportSchema.extend({
  id: z.string(), // Specifically extended since your map function casts it to String()
  salesmanName: z.string(),
  role: z.string(),
  area: z.string(),
  region: z.string(),
  dealerName: z.string().nullable().optional(),
  subDealerName: z.string().nullable().optional(),
  
  // Overriding decimal/numeric types from DB strings to JS numbers
  latitude: z.number(),
  longitude: z.number(),
  dealerTotalPotential: z.number(),
  dealerBestPotential: z.number(),
  todayOrderMt: z.number(),
  todayCollectionRupees: z.number(),
  overdueAmount: z.number().nullable(),
  
  // Formatting standardizations
  reportDate: z.string(),
  checkInTime: z.string(),
  checkOutTime: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
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

// 3. The Cached Function
async function getCachedDailyVisitReports(companyId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(`daily-visit-reports-${companyId}`);

  // Create an alias for subDealers since they reference the same dealers table
  const subDealers = aliasedTable(dealers, 'subDealers');

  // Use getTableColumns and explicit typing to prevent `never[]`
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
    .where(eq(users.companyId, companyId))
    .orderBy(desc(dailyVisitReports.reportDate));

  return results.map((row) => {
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
      
      // Convert Drizzle numeric strings back to numbers for the frontend
      latitude: toNum(row.latitude) ?? 0,
      longitude: toNum(row.longitude) ?? 0,
      dealerTotalPotential: toNum(row.dealerTotalPotential) ?? 0,
      dealerBestPotential: toNum(row.dealerBestPotential) ?? 0,
      todayOrderMt: toNum(row.todayOrderMt) ?? 0,
      todayCollectionRupees: toNum(row.todayCollectionRupees) ?? 0,
      overdueAmount: toNum(row.overdueAmount),
      
      // Handle timestamp formatting
      checkInTime: row.checkInTime ? new Date(row.checkInTime).toISOString() : '',
      checkOutTime: row.checkOutTime ? new Date(row.checkOutTime).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    };
  });
}

export async function GET() {
  if (typeof connection === 'function') await connection();
  
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User lookup
    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    // 3. Role-based Authorization
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Call the cached function
    const formattedReports = await getCachedDailyVisitReports(currentUser.companyId);

    // 5. Validate using strictly extended Schema instead of `.loose()`
    const validatedReports = z.array(frontendDVRSchema).safeParse(formattedReports);

    if (!validatedReports.success) {
      console.error('DVR Validation Error:', validatedReports.error.format());
      // Graceful fallback: return the formatted data directly so the UI doesn't crash on an unexpected null
      return NextResponse.json(formattedReports, { status: 200 });
    }

    return NextResponse.json(validatedReports.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching daily visit reports:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch daily visit reports', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}