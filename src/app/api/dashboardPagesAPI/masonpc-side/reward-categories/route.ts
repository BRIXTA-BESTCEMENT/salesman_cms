// src/app/api/dashboardPagesAPI/masonpc-side/reward-categories/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, rewardCategories } from '../../../../../../drizzle'; 
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
// Use Drizzle-baked schema
import { selectRewardsSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Insufficient permissions.` }, { status: 403 });
    }

    // Fetch RewardCategory Records (Master list)
    const categoryRecords = await db
      .select()
      .from(rewardCategories)
      .orderBy(asc(rewardCategories.name))
      .limit(200);

    // Validate core data structure using the baked schema
    const validatedReports = z.array(selectRewardsSchema.loose()).parse(categoryRecords);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching reward categories:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
  }
}