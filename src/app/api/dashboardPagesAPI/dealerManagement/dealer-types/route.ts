// src/app/api/dashboardPagesAPI/dealerManagement/dealer-types/route.ts
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

    // Fetch all unique types for the current dealer's 
    const uniqueTypes = await prisma.dealer.findMany({
      where: {
        user: { companyId: currentUser.companyId },
      },
      select: { type: true },
      distinct: ['type'], // This is the key part of the query
    });

    // Extract the string values from the query results
    const type = uniqueTypes.map((a:any) => a.type);

    return NextResponse.json({ type }, { status: 200 });

  } catch (error) {
    console.error('Error fetching types:', error);
    return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 });
  }
}