// src/app/api/dashboardPagesAPI/masonpc-side/rewards/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { rewardSchema, rewardCategorySchema } from '@/lib/shared-zod-schema'; // Assuming schemas are exported here

// Re-using the allowed roles from your sample. Adjust as needed.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

const rewardCreateSchema = z.object({
  name: z.string().min(1),
  pointCost: z.number().int().min(1),
  stock: z.number().int().min(0),
  categoryId: z.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
  schemeIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true }
    });

    // 3. Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only allowed roles can access this data.` }, { status: 403 });
    }

    // 4. Fetch Rewards Records (Master list, no company filtering needed)
    const rewardsRecords = await prisma.rewards.findMany({
      select: {
        id: true,
        name: true,
        pointCost: true,
        stock: true,
        totalAvailableQuantity: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        category: { // Include the category name for flattening
          select: { name: true }
        },
        schemes: {
          select: { id: true }
        }
      },
      orderBy: {
        name: 'asc',
      },
      take: 500, // A reasonable limit
    });

    // 5. Format and Flatten the data
    const formattedRewards = rewardsRecords.map(record => ({
      id: record.id,
      name: record.name,
      pointCost: record.pointCost, // Int field
      stock: record.stock, // Int field
      totalAvailableQuantity: record.totalAvailableQuantity, // Int field
      isActive: record.isActive,
      categoryName: record.category?.name ?? 'Uncategorized', // Flattened field
      schemeIds: record.schemes.map(s => String(s.id)),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));

    // 6. Validate core data structure
    // Create a temporary schema for the API response structure that includes the flattened categoryName
    const rewardResponseSchema = z.object({
      id: z.number().int(),
      name: z.string(),
      pointCost: z.number().int(),
      stock: z.number().int(),
      totalAvailableQuantity: z.number().int(),
      isActive: z.boolean(),
      categoryName: z.string(), // Flattened field
      schemeIds: z.array(z.string()),
      createdAt: z.string(),
      updatedAt: z.string(),
    });

    const validatedReports = z.array(rewardResponseSchema).parse(formattedRewards);

    return NextResponse.json(validatedReports, { status: 200 });

  } catch (error) {
    console.error('Error fetching rewards data:', error);
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch rewards data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true }
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = rewardCreateSchema.parse(body);

    const newReward = await prisma.rewards.create({
      data: {
        name: parsed.name,
        pointCost: parsed.pointCost,
        stock: parsed.stock,
        totalAvailableQuantity: parsed.stock, // Initial stock sync
        categoryId: parsed.categoryId,
        isActive: parsed.isActive,
        schemes: parsed.schemeIds ? {
          connect: parsed.schemeIds.map(id => ({ id }))
        } : undefined,
      },
    });

    return NextResponse.json(newReward, { status: 201 });
  } catch (error) {
    console.error('Error creating reward:', error);
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}