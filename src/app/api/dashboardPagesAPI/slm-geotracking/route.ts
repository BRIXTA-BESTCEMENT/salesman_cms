// src/app/api/dashboardPagesAPI/slm-geotracking/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import prisma from '@/lib/prisma';

// Roles allowed to view tracking
const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

// 2. The Cached Function
async function getCachedTracking(companyId: number, startDateParam: string | null, endDateParam: string | null) {
  'use cache';
  cacheLife('minutes'); 
  cacheTag(`slm-geotracking-${companyId}`);

  let dateFilter: any = {};

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    dateFilter = {
      createdAt: { gte: start, lte: end },
    };
  }

  const journeyOps = await prisma.journeyOp.findMany({
    where: {
      user: { companyId: companyId },
      ...dateFilter,
      payload: { path: ['status'], equals: 'COMPLETED' }
    },
    include: {
      user: {
        select: {
          firstName: true, lastName: true, email: true, role: true,
          area: true, region: true, salesmanLoginId: true,
          company: { select: { workosOrganizationId: true } }
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: startDateParam ? undefined : 350,
  });

  return journeyOps.map((op) => {
    const payload = (op.payload && typeof op.payload === 'object') ? op.payload as any : {};
    
    return {
      id: op.opId, 
      journeyId: op.journeyId,
      salesmanName: op.user?.firstName && op.user?.lastName ? `${op.user.firstName} ${op.user.lastName}` : 'Unknown',
      employeeId: op.user?.salesmanLoginId ?? null,
      workosOrganizationId: op.user?.company?.workosOrganizationId ?? null,
      salesmanRole: op.user?.role ?? '',
      area: op.user?.area ?? '',
      region: op.user?.region ?? '',
      latitude: Number(payload.latitude) || 0,
      longitude: Number(payload.longitude) || 0,
      totalDistanceTravelled: Number(payload.totalDistance) || 0,
      recordedAt: payload.endedAt || op.createdAt.toISOString(),
      accuracy: Number(payload.accuracy) || null,
      speed: Number(payload.speed) || null,
      heading: Number(payload.heading) || null,
      altitude: Number(payload.altitude) || null,
      locationType: payload.locationType || op.type, 
      activityType: payload.activityType || null,
      appState: payload.appState || null,
      batteryLevel: Number(payload.batteryLevel) || null,
      isCharging: Boolean(payload.isCharging),
      networkStatus: payload.networkStatus || null,
      ipAddress: payload.ipAddress || null,
      siteName: payload.siteName || null,
      checkInTime: payload.checkInTime || null,
      checkOutTime: payload.checkOutTime || null,
      isActive: Boolean(payload.isActive),
      destLat: Number(payload.destLat) || null,
      destLng: Number(payload.destLng) || null,
      createdAt: op.createdAt.toISOString(),
      updatedAt: op.createdAt.toISOString(),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User & Company
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      include: { company: true }
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Date Filters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const formattedReports = await getCachedTracking(currentUser.companyId, startDateParam, endDateParam);

    return NextResponse.json(formattedReports, { status: 200 });

  } catch (error) {
    console.error('Error fetching journey ops:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}