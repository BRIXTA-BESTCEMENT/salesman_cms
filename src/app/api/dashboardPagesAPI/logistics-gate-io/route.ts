// src/app/api/dashboardPagesAPI/logistics-gate-io/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { z } from 'zod';
import { logisticsGateIOSchema } from '@/lib/shared-zod-schema';

const allowedRoles = [
  'president', 
  'senior-general-manager', 
  'general-manager',
  'assistant-sales-manager', 
  'area-sales-manager', 
  'regional-sales-manager',
  'senior-manager', 
  'manager', 
  'assistant-manager',
];

export async function GET(request: NextRequest) {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } 
    });

    // --- ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: `Forbidden: Only the following roles can view logistics data: ${allowedRoles.join(', ')}` }, 
        { status: 403 }
      );
    }

    // --- 3. FILTER LOGIC ---
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const zoneParam = searchParams.get('zone');
    const districtParam = searchParams.get('district');

    let whereClause: any = {};

    // Date Filter (Applied to createdAt to capture all entries created in range)
    // You could also change this to 'gateInDate' if preferred, but createdAt is safer for audit logs.
    if (startDateParam) {
      const start = new Date(startDateParam);
      const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
      
      end.setHours(23, 59, 59, 999);

      whereClause.createdAt = {
        gte: start,
        lte: end,
      };
    }

    // Optional: Filter by Zone or District if passed
    if (zoneParam) {
      whereClause.zone = { equals: zoneParam, mode: 'insensitive' };
    }
    if (districtParam) {
      whereClause.district = { equals: districtParam, mode: 'insensitive' };
    }

    // 4. Fetch Data
    const logisticsRecords = await prisma.logisticsGateIO.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    // 5. Map Data to Schema
    // We need to convert Date objects to ISO strings to satisfy the Zod schema
    const formattedRecords = logisticsRecords.map((record: any) => ({
      id: record.id,
      zone: record.zone,
      district: record.district,
      destination: record.destination,

      // Dates: Convert to String (ISO) or null
      doOrderDate: record.doOrderDate?.toISOString().split('T')[0] ?? null,
      doOrderTime: record.doOrderTime,
      gateInDate: record.gateInDate?.toISOString().split('T')[0] ?? null,
      gateInTime: record.gateInTime,
      processingTime: record.processingTime,
      wbInDate: record.wbInDate?.toISOString().split('T')[0] ?? null,
      wbInTime: record.wbInTime,
      diffGateInTareWt: record.diffGateInTareWt,
      wbOutDate: record.wbOutDate?.toISOString().split('T')[0] ?? null,
      wbOutTime: record.wbOutTime,
      diffTareWtGrossWt: record.diffTareWtGrossWt,
      gateOutDate: record.gateOutDate?.toISOString().split('T')[0] ?? null,
      gateOutTime: record.gateOutTime,

      diffGrossWtGateOut: record.diffGrossWtGateOut,
      diffGrossWtInvoiceDT: record.diffGrossWtInvoiceDT,
      diffInvoiceDTGateOut: record.diffInvoiceDTGateOut,
      diffGateInGateOut: record.diffGateInGateOut,

      // Timestamps
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));

    // 6. Zod Validation
    const validatedData = z.array(logisticsGateIOSchema).parse(formattedRecords);

    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('Error fetching logistics reports:', error);
    return NextResponse.json(
      { message: 'Failed to fetch logistics reports', error: (error as Error).message }, 
      { status: 500 }
    );
  }
}