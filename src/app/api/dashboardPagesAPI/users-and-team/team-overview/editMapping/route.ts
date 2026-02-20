// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
// Import the new hierarchy check
import { canAssignRole } from '@/lib/roleHierarchy';

// Define the allowed roles that can perform this action
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',];

// Define a schema to validate the incoming request body
const editMappingSchema = z.object({
  userId: z.number(), // The ID of the user whose reportsToId is being updated
  reportsToId: z.number().nullable(), // The ID of the new manager, or null to remove mapping
  managesIds: z.array(z.number()).optional().default([]), // The IDs of the users this user now manages
});

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    const currentUserRole = claims?.role as string;
    const workosOrganizationId = claims?.org_id;

    // Authentication and authorization check: ensure the user is an admin
    if (!claims || !claims.sub || !workosOrganizationId || !allowedRoles.includes(currentUserRole)) {
      console.warn('Unauthorized attempt to update user mapping by:', claims?.sub);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedBody = editMappingSchema.safeParse(body);

    if (!validatedBody.success) {
      console.error('Edit Mapping Validation Error:', validatedBody.error.format());
      return NextResponse.json({ message: 'Invalid request body', errors: validatedBody.error.format() }, { status: 400 });
    }

    const { userId, reportsToId, managesIds } = validatedBody.data;

    // Prevent self-reporting
    if (reportsToId === userId) {
      return NextResponse.json({ error: "A user cannot report to themselves" }, { status: 400 });
    }

    // Prevent self in managesIds
    if (managesIds.includes(userId)) {
      return NextResponse.json({ error: "A user cannot manage themselves" }, { status: 400 });
    }

    if (reportsToId) {
      const manager = await prisma.user.findUnique({
        where: { id: reportsToId },
        select: { role: true },
      });

      if (!manager) {
        return NextResponse.json({ error: 'Target manager not found' }, { status: 404 });
      }

      if (!canAssignRole(currentUserRole, manager.role)) {
        return NextResponse.json({ error: 'Forbidden: You cannot assign this manager' }, { status: 403 });
      }
    }

    // Use a Prisma transaction to ensure all updates are atomic
    await prisma.$transaction(async (tx:any) => {
      // Step 1: Get the current direct reports for the user
      const currentDirectReports = await tx.user.findMany({
        where: {
          reportsToId: userId
        },
        select: { id: true }
      });
      const currentDirectReportIds = currentDirectReports.map((report:any) => report.id);

      // Step 2: Users to be unmanaged (no longer in the managesIds list)
      const usersToUnmanage = currentDirectReportIds.filter((id:any) => !managesIds.includes(id));
      if (usersToUnmanage.length > 0) {
        await tx.user.updateMany({
          where: {
            id: { in: usersToUnmanage }
          },
          data: {
            reportsToId: null
          }
        });
      }

      // Step 3: Update all users in the new managesIds list to report to the current user
      if (managesIds.length > 0) {
        // Ensure all assigned direct reports are valid according to hierarchy
        const targetUsers = await tx.user.findMany({
          where: { id: { in: managesIds } },
          select: { id: true, role: true }
        });

        for (const target of targetUsers) {
          if (!canAssignRole(currentUserRole, target.role)) {
            throw new Error(`Forbidden: You cannot manage user with role ${target.role}`);
          }
        }

        await tx.user.updateMany({
          where: { id: { in: managesIds } },
          data: { reportsToId: userId }
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { reportsToId }
      });
    });

    console.log(`Successfully updated mapping for user ${userId}. New reportsToId: ${reportsToId}`);
    return NextResponse.json({ message: 'Mapping updated successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error updating user mapping:', error);
    // You could check for specific Prisma errors here if needed
    return NextResponse.json({ error: 'Failed to update user mapping' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}