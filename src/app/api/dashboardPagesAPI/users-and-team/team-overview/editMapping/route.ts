// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../../../../../drizzle';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { canAssignRole } from '@/lib/roleHierarchy';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager', 
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager', 
  'senior-manager', 'manager', 'assistant-manager'];

const editMappingSchema = z.object({
  userId: z.number(),
  reportsToId: z.number().nullable(),
  managesIds: z.array(z.number()).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub || !allowedRoles.includes(claims.role as string)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { userId, reportsToId, managesIds } = editMappingSchema.parse(body);

    if (reportsToId === userId || managesIds.includes(userId)) return NextResponse.json({ error: "Self-mapping forbidden" }, { status: 400 });

    if (reportsToId) {
      const [manager] = await db.select({ role: users.role }).from(users).where(eq(users.id, reportsToId)).limit(1);
      if (!manager || !canAssignRole(claims.role as string, manager.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.transaction(async (tx) => {
      // Unassign current reports that are no longer in the list
      await tx.update(users).set({ reportsToId: null }).where(eq(users.reportsToId, userId));
      
      // Assign new reports
      if (managesIds.length > 0) {
        await tx.update(users).set({ reportsToId: userId }).where(inArray(users.id, managesIds));
      }

      // Update user's manager
      await tx.update(users).set({ reportsToId }).where(eq(users.id, userId));
    });

    return NextResponse.json({ message: 'Mapping updated' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}