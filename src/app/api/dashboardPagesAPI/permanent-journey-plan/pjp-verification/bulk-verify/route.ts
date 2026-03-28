// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/bulk-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, permanentJourneyPlans } from '../../../../../../../drizzle'; 
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { refreshCompanyCache } from '@/app/actions/cache';
import { selectPermanentJourneyPlanSchema } from '../../../../../../../drizzle/zodSchemas'; 
import { verifySession } from '@/lib/auth';

const bulkVerifySchema = z.object({
  ids: z.array(selectPermanentJourneyPlanSchema.shape.id).min(1, "At least one PJP ID is required"),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
    if (!hasRequiredPerms) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // 2. Parse and validate body
    const body = await request.json();
    const validated = bulkVerifySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid IDs provided', details: validated.error.issues }, { status: 400 });
    }

    const { ids } = validated.data;

    const validPJPs = await db
      .select({ id: permanentJourneyPlans.id })
      .from(permanentJourneyPlans)
      .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
      .where(
        and(
          inArray(permanentJourneyPlans.id, ids),
          eq(users.companyId, session.companyId)
        )
      );

    const validIds = validPJPs.map(p => p.id);

    if (validIds.length === 0) {
      return NextResponse.json({ message: 'No valid PJPs found for this company.' }, { status: 200 });
    }

    // 4. Perform Bulk Update
    await db
      .update(permanentJourneyPlans)
      .set({
        verificationStatus: 'VERIFIED',
        status: 'VERIFIED',
      })
      .where(inArray(permanentJourneyPlans.id, validIds));

    // 5. CACHE INVALIDATION
    await refreshCompanyCache('pjp-verification');
    await refreshCompanyCache('permanent-journey-plan');

    return NextResponse.json({
      message: `${validIds.length} PJPs verified successfully`,
      count: validIds.length
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Bulk PJP Verification:', error);
    return NextResponse.json({ 
      error: 'Bulk update failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}