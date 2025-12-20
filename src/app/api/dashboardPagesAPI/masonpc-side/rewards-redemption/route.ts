// src/app/api/dashboardPagesAPI/masonpc-side/rewards-redemption/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { rewardRedemptionSchema, rewardSchema } from '@/lib/shared-zod-schema'; // Assuming schemas are exported here

// Re-using the allowed roles from your sample. Adjust as needed.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true, companyId: true }
    });

    // 3. Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only allowed roles can access this data.` }, { status: 403 });
    }

    // 4. Fetch RewardRedemption Records for the current user's company
    const redemptionRecords = await prisma.rewardRedemption.findMany({
      where: {
        // Filter records where the associated mason's user belongs to the current user's company
        mason: {
          user: {
            companyId: currentUser.companyId,
          },
        },
      },
      select: {
        id: true,
        masonId: true,
        rewardId: true,
        quantity: true,
        status: true,
        fulfillmentNotes: true,
        pointsDebited: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddress: true,
        createdAt: true,
        updatedAt: true,
        mason: { select: { name: true } }, // Join to get Mason Name
        reward: { select: { name: true } }, // Join to get Reward Name
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Add a reasonable limit
    });

    // 5. Format and Flatten the data
    const formattedReports = redemptionRecords.map(record => ({
      id: record.id,
      masonId: record.masonId,
      masonName: record.mason.name, // Flattened field
      rewardId: record.rewardId,
      rewardName: record.reward.name, // Flattened field
      quantity: record.quantity,
      status: record.status,
      fulfillmentNotes: record.fulfillmentNotes,
      pointsDebited: record.pointsDebited,
      deliveryName: record.deliveryName ?? null,
      deliveryPhone: record.deliveryPhone ?? null,
      deliveryAddress: record.deliveryAddress ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
    
    // 6. Validate core data structure
    // Create a temporary schema for the API response structure that includes the flattened names
    const redemptionResponseSchema = z.object({
        id: z.string(),
        masonId: z.string(),
        masonName: z.string(), // Flattened field
        rewardId: z.number().int(),
        rewardName: z.string(), // Flattened field
        quantity: z.number().int(),
        status: z.string(),
        pointsDebited: z.number().int(),
        deliveryName: z.string().nullable(),
        deliveryPhone: z.string().nullable(),
        deliveryAddress: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
    });

    const validatedReports = z.array(redemptionResponseSchema).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching rewards redemption data:', error);
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch rewards redemption data' }, { status: 500 });
  }
}