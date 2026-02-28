// src/app/api/dashboardPagesAPI/slm-attendance/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, salesmanAttendance } from '../../../../../drizzle'; 
import { eq, and, or, ilike, gte, lte, desc, getTableColumns, count, SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesmanAttendanceSchema } from '../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive'
];

const frontendAttendanceSchema = selectSalesmanAttendanceSchema.extend({
  salesmanName: z.string(),
  date: z.string(),
  location: z.string().nullable().optional(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  
  inTimeLatitude: z.number().nullable(),
  inTimeLongitude: z.number().nullable(),
  inTimeAccuracy: z.number().nullable(),
  inTimeSpeed: z.number().nullable(),
  inTimeHeading: z.number().nullable(),
  inTimeAltitude: z.number().nullable(),
  outTimeLatitude: z.number().nullable(),
  outTimeLongitude: z.number().nullable(),
  outTimeAccuracy: z.number().nullable(),
  outTimeSpeed: z.number().nullable(),
  outTimeHeading: z.number().nullable(),
  outTimeAltitude: z.number().nullable(),
  
  createdAt: z.string(),
  updatedAt: z.string(),
  salesmanRole: z.string(),
  area: z.string(),
  region: z.string(),
  role: z.string().nullable().optional(), 
});

type AttendanceRow = InferSelectModel<typeof salesmanAttendance> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
};

async function getCachedAttendance(
  companyId: number, 
  page: number,
  pageSize: number,
  search: string | null,
  jobTitle: string | null,
  companyRole: string | null,
  area: string | null,
  region: string | null,
  startDateParam: string | null, 
  endDateParam: string | null
) {
  'use cache';
  cacheLife('hours'); 
  
  const filterKey = `${search}-${jobTitle}-${companyRole}-${area}-${region}-${startDateParam}-${endDateParam}`;
  cacheTag(`salesman-attendance-${companyId}-${page}-${filterKey}`); 

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(salesmanAttendance.locationName, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (jobTitle && jobTitle !== 'all') filters.push(eq(users.role, jobTitle));
  if (companyRole && companyRole !== 'all') filters.push(eq(salesmanAttendance.role, companyRole));
  if (area && area !== 'all') filters.push(eq(users.area, area));
  if (region && region !== 'all') filters.push(eq(users.region, region));

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    filters.push(gte(salesmanAttendance.attendanceDate, start.toISOString()));
    filters.push(lte(salesmanAttendance.attendanceDate, end.toISOString()));
  }

  const whereClause = and(...filters);

  const attendanceRecords: AttendanceRow[] = await db
    .select({
      ...getTableColumns(salesmanAttendance),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
      userArea: users.area,
      userRegion: users.region,
    })
    .from(salesmanAttendance)
    .leftJoin(users, eq(salesmanAttendance.userId, users.id))
    .where(whereClause)
    .orderBy(desc(salesmanAttendance.attendanceDate), desc(salesmanAttendance.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(salesmanAttendance)
    .leftJoin(users, eq(salesmanAttendance.userId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formattedData = attendanceRecords.map((row) => {
    const salesmanName = [row.userFirstName, row.userLastName]
      .filter(Boolean).join(' ') || row.userEmail || 'N/A';
    
    const toNum = (val: any) => (val ? Number(val) : null);

    return {
      ...row,
      salesmanName: salesmanName,
      date: row.attendanceDate ? new Date(row.attendanceDate).toISOString().split('T')[0] : '',
      location: row.locationName,
      inTime: row.inTimeTimestamp ? new Date(row.inTimeTimestamp).toISOString() : null,
      outTime: row.outTimeTimestamp ? new Date(row.outTimeTimestamp).toISOString() : null,
      
      inTimeLatitude: toNum(row.inTimeLatitude) ?? 0,
      inTimeLongitude: toNum(row.inTimeLongitude) ?? 0,
      inTimeAccuracy: toNum(row.inTimeAccuracy),
      inTimeSpeed: toNum(row.inTimeSpeed),
      inTimeHeading: toNum(row.inTimeHeading),
      inTimeAltitude: toNum(row.inTimeAltitude),
      outTimeLatitude: toNum(row.outTimeLatitude),
      outTimeLongitude: toNum(row.outTimeLongitude),
      outTimeAccuracy: toNum(row.outTimeAccuracy),
      outTimeSpeed: toNum(row.outTimeSpeed),
      outTimeHeading: toNum(row.outTimeHeading),
      outTimeAltitude: toNum(row.outTimeAltitude),
      
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      salesmanRole: row.userRole ?? '',
      area: row.userArea ?? '',
      region: row.userRegion ?? '',
      role: row.role ?? row.userRole ?? '', 
    };
  });

  return { data: formattedData, totalCount };
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

    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const jobTitle = searchParams.get('jobTitle');
    const companyRole = searchParams.get('companyRole');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const result = await getCachedAttendance(
      currentUser.companyId, 
      page, 
      pageSize, 
      search, 
      jobTitle, 
      companyRole, 
      area, 
      region, 
      startDateParam, 
      endDateParam
    );

    const validatedData = z.array(frontendAttendanceSchema).safeParse(result.data);

    if (!validatedData.success) {
      console.error("Attendance Validation Error:", validatedData.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validatedData.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching salesman attendance:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch salesman attendance reports', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}