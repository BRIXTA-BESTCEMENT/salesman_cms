// src/app/api/dashboardPagesAPI/masonpc-side/reward-categories/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, rewardCategories } from '../../../../../../drizzle';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectRewardCategorySchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

export async function GET() {
  await connection();
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Fetch RewardCategory Records (Master list)
    const categoryRecords = await db
      .select()
      .from(rewardCategories)
      .orderBy(asc(rewardCategories.name))
      .limit(200);

    // Validate core data structure using the baked schema
    const validatedReports = z.array(selectRewardCategorySchema.loose()).parse(categoryRecords);

    return NextResponse.json(validatedReports, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching reward categories:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
  }
}