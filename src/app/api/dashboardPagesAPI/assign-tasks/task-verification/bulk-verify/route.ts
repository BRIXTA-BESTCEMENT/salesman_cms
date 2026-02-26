// src/app/api/dashboardPagesAPI/assign-tasks/task-verification/bulk-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dailyTasks } from '../../../../../../../drizzle'; 
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyTaskSchema } from '../../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'Admin', 'president', 'senior-general-manager', 'general-manager',
  'regional-sales-manager', 'senior-manager', 'manager', 'assistant-manager',
];

const bulkVerifySchema = z.object({
  ids: z.array(selectDailyTaskSchema.shape.id).min(1, "At least one Task ID is required"),
});

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = bulkVerifySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid IDs provided', details: validated.error.issues }, { status: 400 });
    }

    const { ids } = validated.data;

    const validTasks = await db
      .select({ id: dailyTasks.id })
      .from(dailyTasks)
      .leftJoin(users, eq(dailyTasks.userId, users.id))
      .where(
        and(
          inArray(dailyTasks.id, ids),
          eq(users.companyId, currentUser.companyId)
        )
      );

    const validIds = validTasks.map(t => t.id);

    if (validIds.length === 0) {
      return NextResponse.json({ message: 'No valid Tasks found for this company.' }, { status: 200 });
    }

    const result = await db
      .update(dailyTasks)
      .set({ status: 'VERIFIED' })
      .where(inArray(dailyTasks.id, validIds));

    return NextResponse.json({
      message: `${validIds.length} Tasks verified successfully`,
      count: validIds.length
    }, { status: 200 });

  } catch (error) {
    console.error('Error in Bulk Task Verification:', error);
    return NextResponse.json({ error: 'Bulk update failed', details: (error as Error).message }, { status: 500 });
  }
}