// src/app/api/dashboardPagesAPI/salesman-attendance/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Replaced local PrismaClient with shared instance
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { z } from 'zod'; // Added Zod Import
import { salesmanAttendanceSchema } from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

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

    let dateFilter: any = {};

    if (startDateParam) {
      const start = new Date(startDateParam);
      // If end date is present use it, otherwise assume single day filter
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      
      // Set end time to the very end of the day (23:59:59.999)
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        attendanceDate: {
          gte: start,
          lte: end,
        },
      };
    }
    // ----------------------------------

    const attendanceRecords = await prisma.salesmanAttendance.findMany({
      where: {
        user: { // Access the User relation
          companyId: currentUser.companyId, // Filter by the admin/manager's company
        },
        ...dateFilter,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            area: true,
            region: true,
          }
        },
      },
      orderBy: {
        attendanceDate: 'desc', // Order by date, newest first
      },
    });

    // Map the Prisma data to the desired frontend format
    const formattedRecords = attendanceRecords.map((record:any) => {
      // Construct salesmanName from firstName and lastName, handling potential nulls
      const salesmanName = [record.user?.firstName, record.user?.lastName]
        .filter(Boolean) // Remove any null or undefined parts
        .join(' ') || record.user.email || 'N/A'; // Use email as fallback
      
      let displayLocation = record.locationName;

      return {
        id: record.id,
        salesmanName: salesmanName,
        date: record.attendanceDate.toISOString().split('T')[0], // YYYY-MM-DD
        location: displayLocation,

        // Use ISO string for inTime/outTime for consistency, or keep toLocaleTimeString if that is the strict frontend requirement
        inTime: record.inTimeTimestamp ? record.inTimeTimestamp.toISOString() : null,
        outTime: record.outTimeTimestamp ? record.outTimeTimestamp.toISOString() : null,

        inTimeImageCaptured: record.inTimeImageCaptured,
        outTimeImageCaptured: record.outTimeImageCaptured,
        inTimeImageUrl: record.inTimeImageUrl,
        outTimeImageUrl: record.outTimeImageUrl,

        // Since inTimeLatitude and inTimeLongitude are required in the schema, we assume they exist.
        inTimeLatitude: record.inTimeLatitude.toNumber(), // Convert Decimal to Number
        inTimeLongitude: record.inTimeLongitude.toNumber(),

        // Optional decimal fields are converted to number or null
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

        // Added Timestamps
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),

        salesmanRole: record.user?.role ?? '',
        area: record.user?.area ?? '',
        region: record.user?.region ?? '',
        role: record.role,
      };
    });

    // 3. Zod Validation
    const validatedData = z.array(salesmanAttendanceSchema).parse(formattedRecords);

    return NextResponse.json(validatedData, { status: 200 });
  } catch (error) {
    console.error('Error fetching salesman attendance reports:', error);
    return NextResponse.json({ message: 'Failed to fetch salesman attendance reports', error: (error as Error).message }, { status: 500 });
  }
}
