// src/app/api/dashboardPagesAPI/dealerManagement/dealer-locations/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../drizzle'; 
import { eq, or, isNull, asc } from 'drizzle-orm';

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

    // Use Promise.all to fetch regions and areas in parallel
    // We use a broader filter: dealers in my company OR unassigned dealers
    const [uniqueRegions, uniqueAreas] = await Promise.all([
      db
        .selectDistinct({ region: dealers.region })
        .from(dealers)
        .leftJoin(users, eq(dealers.userId, users.id))
        .where(
          or(
            eq(users.companyId, currentUser.companyId),
            isNull(dealers.userId) // Include orphans so their regions appear in filters
          )
        )
        .orderBy(asc(dealers.region)),
        
      db
        .selectDistinct({ area: dealers.area })
        .from(dealers)
        .leftJoin(users, eq(dealers.userId, users.id))
        .where(
          or(
            eq(users.companyId, currentUser.companyId),
            isNull(dealers.userId)
          )
        )
        .orderBy(asc(dealers.area))
    ]);

    // Clean up the data (remove nulls/empty strings)
    const regions = uniqueRegions
      .map((r) => r.region)
      .filter((r): r is string => Boolean(r && r.trim() !== ""));
      
    const areas = uniqueAreas
      .map((a) => a.area)
      .filter((a): a is string => Boolean(a && a.trim() !== ""));

    return NextResponse.json({ regions, areas }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: `Failed to fetch locations: ${error.message}` }, 
      { status: 500 }
    );
  }
}