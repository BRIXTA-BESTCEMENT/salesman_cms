// src/app/api/dashboardPagesAPI/masonpc-side/rewards/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { rewards, rewardCategories, schemeToRewards } from '../../../../../../drizzle';
import { sql, eq, asc } from 'drizzle-orm';
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

    const formattedRewards = await db
      .select({
        id: rewards.id,
        itemName: rewards.itemName,
        pointCost: rewards.pointCost,
        totalAvailableQuantity: rewards.totalAvailableQuantity,
        stock: rewards.stock,
        isActive: rewards.isActive,
        createdAt: rewards.createdAt,
        updatedAt: rewards.updatedAt,
        categoryId: rewards.categoryId,
        categoryName: sql<string>`COALESCE(MAX(${rewardCategories.name}), 'Uncategorized')`,
        // Aggregates the joined scheme UUIDs into an array automatically:
        schemeIds: sql<string[]>`COALESCE(array_agg(${schemeToRewards.b}) FILTER (WHERE ${schemeToRewards.b} IS NOT NULL), '{}')`
      })
      .from(rewards)
      .leftJoin(rewardCategories, eq(rewards.categoryId, rewardCategories.id))
      .leftJoin(schemeToRewards, eq(rewards.id, schemeToRewards.a))
      .groupBy(rewards.id) // Group by the base table ID
      .orderBy(asc(rewards.itemName))
      .limit(1000);

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