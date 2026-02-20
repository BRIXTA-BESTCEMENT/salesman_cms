// src/app/api/dashboardPagesAPI/users-and-team/users/user-locations/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { companyId: true }
    });
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch all unique regions for the current user's company from the User table
    const uniqueRegions = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        region: { not: null } // Exclude null values
      },
      select: { region: true },
      distinct: ['region'],
    });

    // Fetch all unique areas for the current user's company from the User table
    const uniqueAreas = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        area: { not: null } // Exclude null values
      },
      select: { area: true },
      distinct: ['area'],
    });

    // Extract the string values from the query results
    const regions = uniqueRegions.map((r:any) => r.region || '').filter(Boolean);
    const areas = uniqueAreas.map((a:any) => a.area || '').filter(Boolean);

    return NextResponse.json({ regions, areas }, { status: 200 });

  } catch (error) {
    console.error('Error fetching user locations:', error);
    return NextResponse.json({ error: 'Failed to fetch user locations' }, { status: 500 });
  }
}