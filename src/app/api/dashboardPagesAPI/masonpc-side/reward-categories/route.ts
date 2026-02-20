// src/app/api/dashboardPagesAPI/masonpc-side/reward-categories/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { rewardCategorySchema } from '@/lib/shared-zod-schema'; // Assuming RewardCategorySchema is exported here

// Re-using the allowed roles from your sample. Adjust as needed.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
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

    // 4. Fetch RewardCategory Records (Master list, no company filtering needed)
    const categoryRecords = await prisma.rewardCategory.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 200, // A reasonable limit for a category list
    });

    // 5. Format the data (Minimal formatting needed as fields map directly)
    const formattedCategories = categoryRecords.map(record => ({
      id: record.id,
      name: record.name,
    }));
    
    // 6. Validate core data structure
    const categoryResponseSchema = z.object({
        id: z.number().int(),
        name: z.string(),
    });

    const validatedReports = z.array(categoryResponseSchema).parse(formattedCategories);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching reward categories data:', error);
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch reward categories data' }, { status: 500 });
  }
}