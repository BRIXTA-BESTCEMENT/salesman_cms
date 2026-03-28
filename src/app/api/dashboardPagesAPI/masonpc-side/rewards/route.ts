// src/app/api/dashboardPagesAPI/masonpc-side/rewards/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { rewards, rewardCategories, schemeToRewards } from '../../../../../../drizzle';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectRewardsSchema, insertRewardsSchema } from '../../../../../../drizzle/zodSchemas';
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

    // 1. Fetch raw records with LEFT JOINs
    const rawRecords = await db
      .select({
        reward: rewards,
        categoryName: rewardCategories.name,
        schemeId: schemeToRewards.b, // 'b' holds the scheme UUID based on your schema
      })
      .from(rewards)
      .leftJoin(rewardCategories, eq(rewards.categoryId, rewardCategories.id))
      .leftJoin(schemeToRewards, eq(rewards.id, schemeToRewards.a)) // 'a' holds the reward integer ID
      .orderBy(asc(rewards.itemName))
      .limit(1000); // Increased limit slightly to account for duplicate rows before grouping

    // 2. Group the results
    const rewardsMap = new Map();

    rawRecords.forEach((row) => {
      const rewardId = row.reward.id;

      if (!rewardsMap.has(rewardId)) {
        rewardsMap.set(rewardId, {
          ...row.reward,
          name: row.reward.itemName,
          categoryName: row.categoryName ?? 'Uncategorized',
          schemeIds: [], // Initialize the array the frontend is looking for
          createdAt: new Date(row.reward.createdAt).toISOString(),
          updatedAt: new Date(row.reward.updatedAt).toISOString(),
        });
      }

      // If there's a linked scheme, push its ID into the array
      if (row.schemeId) {
        rewardsMap.get(rewardId).schemeIds.push(row.schemeId);
      }
    });

    // 3. Convert Map back to array and validate
    const formattedRewards = Array.from(rewardsMap.values());
    const validated = z.array(selectRewardsSchema.loose()).parse(formattedRewards);

    return NextResponse.json(validated, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
    if (!hasRequiredPerms) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();

    const parsed = insertRewardsSchema.parse({
      itemName: body.name,
      pointCost: body.pointCost,
      stock: body.stock,
      totalAvailableQuantity: body.stock,
      categoryId: body.categoryId,
      isActive: body.isActive ?? true,
    });

    const [newReward] = await db
      .insert(rewards)
      .values(parsed)
      .returning();

    return NextResponse.json(newReward, { status: 201 });
  } catch (error: any) {
    console.error('Error creating reward:', error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create reward', details: error.message }, { status: 500 });
  }
}