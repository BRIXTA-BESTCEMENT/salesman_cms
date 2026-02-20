// src/app/api/dashboardPagesAPI/users-and-team/users/user-roles/route.ts
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

    // Fetch all unique roles for the current user's company from the User table
    const uniqueRoles = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
      },
      select: { role: true },
      distinct: ['role'],
    });

    // Extract the string values from the query results
    const roles = uniqueRoles.map((a:any) => a.role || '').filter(Boolean);

    // FIX: Return the roles using the correct 'roles' key
    return NextResponse.json({ roles }, { status: 200 });

  } catch (error) {
    console.error('Error fetching user roles:', error); 
    return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 });
  }
}