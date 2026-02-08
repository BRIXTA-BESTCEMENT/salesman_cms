// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editRole/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { WorkOS } from '@workos-inc/node';
// Import the new hierarchy check
import { canAssignRole } from '@/lib/roleHierarchy';

// Initialize WorkOS with your API key
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager', 'senior-executive', 'executive'];

const editRoleSchema = z.object({
  userId: z.number(),
  newRole: z.string().refine(role => allowedRoles.includes(role), {
    message: 'Invalid role provided. Role must be one of the allowed admin roles.',
  }),
});

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    const currentUserRole = claims?.role as string;
    const workosOrganizationId = claims?.org_id;

    // Authentication and authorization check
    if (!claims || !claims.sub || !workosOrganizationId || !allowedRoles.includes(currentUserRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedBody = editRoleSchema.safeParse(body);

    if (!validatedBody.success) {
      console.error('Edit Role Validation Error:', validatedBody.error.format());
      return NextResponse.json({ message: 'Invalid request body', errors: validatedBody.error.format() }, { status: 400 });
    }

    const { userId, newRole } = validatedBody.data;

    // **IMPORTANT NEW CHECK**: Validate that the current user can assign this new role
    if (!canAssignRole(currentUserRole, newRole)) {
      console.warn(`Unauthorized role change attempt by user ${claims.sub}: tried to set role to ${newRole}`);
      return NextResponse.json({ error: 'Forbidden: You cannot assign this role' }, { status: 403 });
    }

    // Use a transaction to ensure both the Prisma and WorkOS updates are successful.
    const updatedUser = await prisma.$transaction(async (prisma:any) => {
      // Step 1: Find the user in the database to get their WorkOS ID and the company's WorkOS ID
      const userToUpdate = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          workosUserId: true,
          company: {
            select: {
              workosOrganizationId: true,
            },
          },
        },
      });

      if (!userToUpdate || !userToUpdate.workosUserId || !userToUpdate.company?.workosOrganizationId) {
        throw new Error('User or WorkOS organization ID not found');
      }

      // Step 2: Find the organization membership ID for the user
      // NOTE: The `listOrganizationMemberships` function is now directly on the `workos` instance.
      const { data: memberships } = await workos.userManagement.listOrganizationMemberships({
        userId: userToUpdate.workosUserId,
        organizationId: userToUpdate.company.workosOrganizationId,
      });

      const userMembership = memberships.find(
        (membership) => membership.userId === userToUpdate.workosUserId
      );

      if (!userMembership) {
        throw new Error('WorkOS organization membership not found for user');
      }

      // Step 3: Update the user's role in WorkOS using the membership ID
      // The `updateOrganizationMembership` function is also now directly on the `workos` instance.
      await workos.userManagement.updateOrganizationMembership(
        userMembership.id,
        { roleSlug: newRole },
      );

      // Step 4: Update the user's role in the local database
      const prismaUpdatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
      });

      return prismaUpdatedUser;
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found or not in company' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Role updated successfully', user: updatedUser }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user role' }, { status: 500 });
  }
}
