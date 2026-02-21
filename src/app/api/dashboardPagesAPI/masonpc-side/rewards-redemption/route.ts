// src/app/api/dashboardPagesAPI/masonpc-side/rewards-redemption/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, rewardRedemptions, rewards, masonPcSide } from '../../../../../../drizzle'; 
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectRewardRedemptionSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive'
];

async function getCachedRedemptions(companyId: number) {
  'use cache';
  cacheLife('days');
  cacheTag(`rewards-redemption-${companyId}`);

  const results = await db
    .select({
      redemption: rewardRedemptions,
      masonName: masonPcSide.name,
      rewardName: rewards.itemName, // Using itemName from your Drizzle schema
    })
    .from(rewardRedemptions)
    .leftJoin(masonPcSide, eq(rewardRedemptions.masonId, masonPcSide.id))
    .leftJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(rewardRedemptions.createdAt))
    .limit(1000);

  return results.map(({ redemption, masonName, rewardName }) => ({
    ...redemption,
    masonName: masonName || 'Unknown',
    rewardName: rewardName || 'Unknown',
    createdAt: new Date(redemption.createdAt).toISOString(),
    updatedAt: new Date(redemption.updatedAt).toISOString(),
  }));
}

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden` }, { status: 403 });
    }

    const formattedReports = await getCachedRedemptions(currentUser.companyId);
    // Use .loose() to allow the extra joined fields
    const validatedReports = z.array(selectRewardRedemptionSchema.loose()).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching redemptions:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
  }
}