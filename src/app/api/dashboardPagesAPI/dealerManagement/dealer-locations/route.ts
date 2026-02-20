// src/app/api/dashboardPagesAPI/dealerManagement/dealer-locations/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';

export async function GET() {
  await connection();
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

    // Use Promise.all to fetch regions and areas in parallel
    // We use a broader filter: dealers in my company OR unassigned dealers
    // (This matches the logic we added to the editDealerMapping route)
    const [uniqueRegions, uniqueAreas] = await Promise.all([
      prisma.dealer.findMany({
        where: {
          OR: [
            { user: { companyId: currentUser.companyId } },
            { userId: null } // Include orphans so their regions appear in filters
          ]
        },
        select: { region: true },
        distinct: ['region'],
        orderBy: { region: 'asc' }
      }),
      prisma.dealer.findMany({
        where: {
          OR: [
            { user: { companyId: currentUser.companyId } },
            { userId: null }
          ]
        },
        select: { area: true },
        distinct: ['area'],
        orderBy: { area: 'asc' }
      })
    ]);

    // Clean up the data (remove nulls/empty strings)
    const regions = uniqueRegions
      .map((r) => r.region)
      .filter((r) => r && r.trim() !== "");
      
    const areas = uniqueAreas
      .map((a) => a.area)
      .filter((a) => a && a.trim() !== "");

    return NextResponse.json({ regions, areas }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: `Failed to fetch locations: ${error.message}` }, 
      { status: 500 }
    );
  }
}