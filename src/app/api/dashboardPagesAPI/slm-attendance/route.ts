// src/app/api/dashboardPagesAPI/slm-attendance/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, salesmanAttendance } from '../../../../../drizzle'; 
import { eq, and, gte, lte, desc, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesmanAttendanceSchema } from '../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive'
];

// 1. Extend the baked DB schema for strict frontend typing
const frontendAttendanceSchema = selectSalesmanAttendanceSchema.extend({
  salesmanName: z.string(),
  date: z.string(),
  location: z.string().nullable().optional(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  
  // Override decimals/numerics from Postgres strings to JS numbers
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
  
  // Timestamps & Joined Data
  createdAt: z.string(),
  updatedAt: z.string(),
  salesmanRole: z.string(),
  area: z.string(),
  region: z.string(),
  role: z.string().nullable().optional(), // Preserved from old Prisma logic
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
type AttendanceRow = InferSelectModel<typeof salesmanAttendance> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
};

// 3. The Cached Function
async function getCachedAttendance(companyId: number, startDateParam: string | null, endDateParam: string | null) {
  'use cache';
  cacheLife('hours'); 
  cacheTag(`salesman-attendance-${companyId}`); 

  const filters = [eq(users.companyId, companyId)];

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    filters.push(gte(salesmanAttendance.attendanceDate, start.toISOString()));
    filters.push(lte(salesmanAttendance.attendanceDate, end.toISOString()));
  }

  // Use getTableColumns to flatten the query natively
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
    .where(and(...filters))
    .orderBy(desc(salesmanAttendance.attendanceDate));

  return attendanceRecords.map((row) => {
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
      
      // Handle Numeric string to Number conversion for Drizzle
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
      role: row.role ?? row.userRole ?? '', // Fallback to user role if table role is missing
    };
  });
}

export async function GET(request: NextRequest) {
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

    // 3. Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 4. Fetch from Cache
    const formattedRecords = await getCachedAttendance(currentUser.companyId, startDateParam, endDateParam);

    // 5. Safe Parse Zod Validation using strictly extended schema
    const validatedData = z.array(frontendAttendanceSchema).safeParse(formattedRecords);

    if (!validatedData.success) {
      console.error("Attendance Validation Error:", validatedData.error.format());
      // Graceful fallback to raw mapped data to prevent total UI collapse
      return NextResponse.json(formattedRecords, { status: 200 }); 
    }

    return NextResponse.json(validatedData.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching salesman attendance:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch salesman attendance reports', 
      error: (error as Error).message 
    }, { status: 500 });
  }
}