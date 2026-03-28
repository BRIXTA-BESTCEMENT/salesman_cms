// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editRole/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { users } from '../../../../../../../drizzle';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { canAssignRole } from '@/lib/roleHierarchy';

const editRoleSchema = z.object({
  userId: z.number(),
  newRole: z.string().min(1, "New role is required"),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify custom session
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
    if (!hasRequiredPerms) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedBody = editRoleSchema.safeParse(body);

    if (!validatedBody.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: validatedBody.error.format() },
        { status: 400 }
      );
    }

    const { userId, newRole } = validatedBody.data;

    // 2. Check Hierarchy (Logic stays the same, just uses session.role)
    if (!canAssignRole(session.orgRole, newRole)) {
      return NextResponse.json({ error: 'Forbidden: You cannot assign this role level' }, { status: 403 });
    }

    // 3. Update the database
    const updatedUser = await db.transaction(async (tx) => {
      const [targetUser] = await tx
        .select({ id: users.id, companyId: users.companyId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!targetUser || targetUser.companyId !== session.companyId) {
        throw new Error("User not found or belongs to a different company");
      }

      // Perform the update
      const [updated] = await tx
        .update(users)
        .set({
          role: newRole,
          updatedAt: sql`now()`
        })
        .where(eq(users.id, userId))
        .returning();

      return updated;
    });

    return NextResponse.json(
      { message: 'Role updated successfully', user: updatedUser },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user role' },
      { status: 500 }
    );
  }
}