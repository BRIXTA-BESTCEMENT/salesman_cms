// src/app/api/dashboardPagesAPI/salesman-attendance/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma'; 
import { z } from 'zod'; 
import { salesmanAttendanceSchema } from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive'
];

// 2. The Cached Function
async function getCachedAttendance(companyId: number, startDateParam: string | null, endDateParam: string | null) {
  'use cache';
  cacheLife('hours'); // Attendance updates frequently, so 'hours' or 'minutes' is safer than 'days'
  cacheTag(`salesman-attendance-${companyId}`); 

  let dateFilter: any = {};

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    dateFilter = {
      attendanceDate: {
        gte: start,
        lte: end,
      },
    };
  }

  const attendanceRecords = await prisma.salesmanAttendance.findMany({
    where: {
      user: { companyId: companyId },
      ...dateFilter,
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, role: true, area: true, region: true } },
    },
    orderBy: { attendanceDate: 'desc' },
  });

  return attendanceRecords.map((record: any) => {
    const salesmanName = [record.user?.firstName, record.user?.lastName]
      .filter(Boolean).join(' ') || record.user.email || 'N/A';
    
    return {
      id: record.id,
      salesmanName: salesmanName,
      date: record.attendanceDate.toISOString().split('T')[0],
      location: record.locationName,
      inTime: record.inTimeTimestamp ? record.inTimeTimestamp.toISOString() : null,
      outTime: record.outTimeTimestamp ? record.outTimeTimestamp.toISOString() : null,
      inTimeImageCaptured: record.inTimeImageCaptured,
      outTimeImageCaptured: record.outTimeImageCaptured,
      inTimeImageUrl: record.inTimeImageUrl,
      outTimeImageUrl: record.outTimeImageUrl,
      inTimeLatitude: record.inTimeLatitude.toNumber(),
      inTimeLongitude: record.inTimeLongitude.toNumber(),
      inTimeAccuracy: record.inTimeAccuracy?.toNumber() ?? null,
      inTimeSpeed: record.inTimeSpeed?.toNumber() ?? null,
      inTimeHeading: record.inTimeHeading?.toNumber() ?? null,
      inTimeAltitude: record.inTimeAltitude?.toNumber() ?? null,
      outTimeLatitude: record.outTimeLatitude?.toNumber() ?? null,
      outTimeLongitude: record.outTimeLongitude?.toNumber() ?? null,
      outTimeAccuracy: record.outTimeAccuracy?.toNumber() ?? null,
      outTimeSpeed: record.outTimeSpeed?.toNumber() ?? null,
      outTimeHeading: record.outTimeHeading?.toNumber() ?? null,
      outTimeAltitude: record.outTimeAltitude?.toNumber() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      salesmanRole: record.user?.role ?? '',
      area: record.user?.area ?? '',
      region: record.user?.region ?? '',
      role: record.role,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } // Optimized selection
    });

    // --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can view attendance data: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    // --- 3. FILTER LOGIC ADDED HERE ---
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 4. Fetch from Cache
    const formattedRecords = await getCachedAttendance(currentUser.companyId, startDateParam, endDateParam);

    // 5. Zod Validation
    const validatedData = z.array(salesmanAttendanceSchema).parse(formattedRecords);

    return NextResponse.json(validatedData, { status: 200 });
  } catch (error) {
    console.error('Error fetching salesman attendance reports:', error);
    return NextResponse.json({ message: 'Failed to fetch salesman attendance reports', error: (error as Error).message }, { status: 500 });
  }
}
