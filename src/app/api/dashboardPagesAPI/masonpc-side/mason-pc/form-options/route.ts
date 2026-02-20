// src/app/api/dashboardPagesAPI/masonpc-side/form-options/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';

export async function GET() {
  try {
    const claims = await getTokenClaims();
    if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { companyId: true },
    });

    if (!currentUser || !currentUser.companyId) return NextResponse.json({ error: 'User/Company not found' }, { status: 403 });

    // 1. Fetch Salesmen (CORRECTED FIELD NAME)
    const users = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        isTechnicalRole: true,
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' }
    });

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName || ''}`.trim(),
    }));

    // 2. Fetch Dealers with Region and Area (Supported by schema )
    const dealers = await prisma.dealer.findMany({
      where: {
        user: {
          companyId: currentUser.companyId
        },
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        name: true,
        region: true, 
        area: true,   
      },
      orderBy: { name: 'asc' },
    });

    // FORMATTING LOGIC: "Name (Region, Area)"
    const formattedDealers = dealers.map((d) => ({
      id: d.id,
      name: `${d.name} (${d.region || '-'}, ${d.area || '-'})`,
    }));

    // 3. Fetch Technical Sites (Supported by schema [cite: 229])
    const sites = await prisma.technicalSite.findMany({
      select: { id: true, siteName: true, region: true, area: true }
    });

    const formattedSites = sites.map((s) => ({
      id: s.id,
      name: `${s.siteName} (${s.region || '-'}, ${s.area || '-'})`
    }));

    return NextResponse.json({
      users: formattedUsers,
      dealers: formattedDealers,
      sites: formattedSites,
    });

  } catch (error: any) {
    console.error('Error fetching form options:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}