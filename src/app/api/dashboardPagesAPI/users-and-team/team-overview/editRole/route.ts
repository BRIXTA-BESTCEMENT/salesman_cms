// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editRole/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../../../../../drizzle';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { WorkOS } from '@workos-inc/node';
import { canAssignRole } from '@/lib/roleHierarchy';

if (!process.env.WORKOS_API_KEY) {
  throw new Error("Missing WORKOS_API_KEY");
}
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager', 'senior-executive', 'executive'];

const editRoleSchema = z.object({
  userId: z.number(),
  newRole: z.string().refine(role => allowedRoles.includes(role), { message: 'Invalid role' }),
});

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    const currentUserRole = claims?.role as string;
    const workosOrganizationId = claims?.org_id;

    if (!claims?.sub || !workosOrganizationId || !allowedRoles.includes(currentUserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (!canAssignRole(currentUserRole, newRole)) {
      return NextResponse.json({ error: 'Forbidden: You cannot assign this role' }, { status: 403 });
    }

    const updatedUser = await db.transaction(async (tx) => {

      const result = await tx
        .select({
          workosUserId: users.workosUserId,
          orgId: companies.workosOrganizationId,
        })
        .from(users)
        .leftJoin(companies, eq(users.companyId, companies.id))
        .where(eq(users.id, userId))
        .limit(1);

      const userToUpdate = result[0];

      const organizationId =
        (userToUpdate?.orgId as string | null | undefined) ??
        (workosOrganizationId as string | null | undefined);

      const shouldUpdateWorkOS =
        !!userToUpdate?.workosUserId && !!organizationId;

      if (shouldUpdateWorkOS) {
        const { data: memberships } =
          await workos.userManagement.listOrganizationMemberships({
            userId: userToUpdate.workosUserId!,
            organizationId: organizationId!,
          });

        const userMembership = memberships.find(
          m => m.userId === userToUpdate.workosUserId
        );

        if (userMembership?.id) {
          await workos.userManagement.updateOrganizationMembership(
            userMembership.id,
            { roleSlug: newRole }
          );
        }
      }

      const [updated] = await tx
        .update(users)
        .set({ role: newRole })
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