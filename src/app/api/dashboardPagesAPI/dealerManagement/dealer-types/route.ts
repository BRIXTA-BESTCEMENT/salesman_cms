// src/app/api/dashboardPagesAPI/dealerManagement/dealer-types/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../drizzle'; 
import { eq } from 'drizzle-orm';

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserResult = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);
      
    const currentUser = currentUserResult[0];
    
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch all unique types for the current company's dealers
    const uniqueTypes = await db
      .selectDistinct({ type: dealers.type })
      .from(dealers)
      .leftJoin(users, eq(dealers.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId));

    // Extract the string values from the query results and filter out nulls
    const type = uniqueTypes.map((a) => a.type).filter(Boolean);

    return NextResponse.json({ type }, { status: 200 });

  } catch (error) {
    console.error('Error fetching types:', error);
    return NextResponse.json({ error: 'Failed to fetch types' }, { status: 500 });
  }
}