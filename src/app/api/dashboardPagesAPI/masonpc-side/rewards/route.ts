// src/app/api/dashboardPagesAPI/masonpc-side/rewards/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { 
  users, 
  rewards, 
  rewardCategories 
} from '../../../../../../drizzle';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectRewardsSchema, insertRewardsSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

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
      return NextResponse.json({ error: `Forbidden: Access denied.` }, { status: 403 });
    }

    const rewardsRecords = await db
      .select({
        reward: rewards,
        categoryName: rewardCategories.name,
      })
      .from(rewards)
      .leftJoin(rewardCategories, eq(rewards.categoryId, rewardCategories.id))
      .orderBy(asc(rewards.itemName))
      .limit(500);

    const formattedRewards = rewardsRecords.map(({ reward, categoryName }) => ({
      ...reward,
      name: reward.itemName, 
      categoryName: categoryName ?? 'Uncategorized',
      createdAt: new Date(reward.createdAt).toISOString(),
      updatedAt: new Date(reward.updatedAt).toISOString(),
    }));

    // Use .loose() to handle the categoryName and any potential name aliasing
    const validated = z.array(selectRewardsSchema.loose()).parse(formattedRewards);

    return NextResponse.json(validated, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    if (!currentUserResult[0] || !allowedRoles.includes(currentUserResult[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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