// src/app/api/dashboardPagesAPI/masonpc-side/rewards-redemption/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, rewardRedemptions, rewards, masonPcSide } from '../../../../../../drizzle';
import { eq, desc, and, ilike, or, gte, lte, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { selectRewardRedemptionSchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

async function getCachedRedemptions(
  companyId: number,
  search: string | null,
  status: string | null,
  startDate: string | null,
  endDate: string | null
) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`rewards-redemption-${companyId}`);

  const filters: (SQL | undefined)[] = [eq(users.companyId, companyId)];

  if (search) {
    filters.push(or(
      ilike(masonPcSide.name, `%${search}%`),
      ilike(rewards.itemName, `%${search}%`)
    ));
  }

  if (status && status !== 'all') {
    filters.push(eq(rewardRedemptions.status, status.toUpperCase()));
  }
  if (startDate) {
    filters.push(gte(rewardRedemptions.createdAt, startDate));
  }
  if (endDate) {
    filters.push(lte(rewardRedemptions.createdAt, `${endDate} 23:59:59`));
  }

  const results = await db
    .select({
      redemption: rewardRedemptions,
      masonName: masonPcSide.name,
      rewardName: rewards.itemName,
    })
    .from(rewardRedemptions)
    .leftJoin(masonPcSide, eq(rewardRedemptions.masonId, masonPcSide.id))
    .leftJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(and(...filters))
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

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const formattedReports = await getCachedRedemptions(
      session.companyId,
      search,
      status,
      startDate,
      endDate
    );

    const validatedReports = z.array(selectRewardRedemptionSchema.loose()).parse(formattedReports);
    return NextResponse.json(validatedReports, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching redemptions:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}