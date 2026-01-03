// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/bulk-verify/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const allowedRoles = [
  'Admin', 'president', 'senior-general-manager', 'general-manager',
  'regional-sales-manager', 'senior-manager', 'manager', 'assistant-manager',
];

// Simple schema for bulk verification
const bulkVerifySchema = z.object({
  ids: z.array(z.string().min(1)),
});

export async function PATCH(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true, companyId: true }
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = bulkVerifySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid IDs provided' }, { status: 400 });
    }

    const { ids } = validated.data;

    // Perform Bulk Update with Multi-tenancy check
    const result = await prisma.permanentJourneyPlan.updateMany({
      where: {
        id: { in: ids },
        user: { companyId: currentUser.companyId } 
      },
      data: {
        verificationStatus: 'VERIFIED',
        status: 'VERIFIED',
      }
    });

    return NextResponse.json({
      message: `${result.count} PJPs verified successfully`,
      count: result.count
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Bulk PJP Verification:', error);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}