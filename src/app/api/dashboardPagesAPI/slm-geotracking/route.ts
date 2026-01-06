// src/app/api/dashboardPagesAPI/slm-geotracking/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { geoTrackingSchema } from '@/lib/shared-zod-schema';


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
      include: { company: true }
    });

    // --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can add dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    // --- 1. EXTRACT DATE FILTERS ---
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    let dateFilter: any = {};

    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      
      // Ensure we cover the entire end day
      end.setHours(23, 59, 59, 999);

      dateFilter = {
        recordedAt: {
          gte: start,
          lte: end,
        },
      };
    }
    // -------------------------------

    // 4. Fetch GeoTracking Records for the current user's company
    const geotrackingReports = await prisma.geoTracking.findMany({
      where: {
        user: {
          companyId: currentUser.companyId,
        },
        ...dateFilter,
      },
      // We must include the user and company to get the workosOrganizationId
      include: {
        user: {
          select: {
            company: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            area: true,
            region: true,
            salesmanLoginId: true,
            // company: {
            //   select: { workosOrganizationId: true },
            // },
          },

        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
      take: startDateParam ? undefined : 350,
    });

    // 5. Format the data for the frontend table display
    const formattedReports = geotrackingReports.map((report:any) => ({
      id: report.id,
      // Add optional chaining to prevent errors if the user object is unexpectedly null
      salesmanName: report.user?.firstName && report.user?.lastName ? `${report.user.firstName} ${report.user.lastName}` : null,
      // Access employeeId from the nested user object, handling potential nulls
      employeeId: report.user?.salesmanLoginId ?? null,
      workosOrganizationId: report.user?.company?.workosOrganizationId ?? null,
      latitude: report.latitude.toNumber(),
      longitude: report.longitude.toNumber(),
      recordedAt: report.recordedAt.toISOString(),
      // Handle the case where totalDistanceTravelled might be null
      totalDistanceTravelled: report.totalDistanceTravelled?.toNumber() ?? null,
      accuracy: report.accuracy?.toNumber() ?? null,
      speed: report.speed?.toNumber() ?? null,
      heading: report.heading?.toNumber() ?? null,
      altitude: report.altitude?.toNumber() ?? null,
      locationType: report.locationType,
      activityType: report.activityType,
      appState: report.appState,
      batteryLevel: report.batteryLevel?.toNumber() ?? null,
      isCharging: report.isCharging,
      networkStatus: report.networkStatus,
      ipAddress: report.ipAddress,
      siteName: report.siteName,
      checkInTime: report.checkInTime?.toISOString() ?? null,
      checkOutTime: report.checkOutTime?.toISOString() ?? null,
      journeyId: report.journeyId ?? null,
      isActive: report.isActive,
      destLat: report.destLat?.toNumber() ?? null,
      destLng: report.destLng?.toNumber() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),

      salesmanRole: report.user?.role ?? '',
      area: report.user?.area ?? '',
      region: report.user?.region ?? '',
    }));

    const validatedReports = z.array(geoTrackingSchema).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
  } catch (error) {
    console.error('Error fetching geo-tracking data:', error);
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch geo-tracking data' }, { status: 500 });
  } finally {
    //await prisma.$disconnect();
  }
}