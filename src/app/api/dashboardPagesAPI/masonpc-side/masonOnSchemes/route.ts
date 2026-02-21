// src/app/api/dashboardPagesAPI/masonpc-side/masonOnSchemes/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, masonOnScheme, masonPcSide } from '../../../../../../drizzle'; 
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
// Use Drizzle-baked schema
import { selectMasonOnSchemeSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Insufficient permissions.` }, { status: 403 });
    }

    const records = await db
      .select({
        masonId: masonOnScheme.masonId,
        schemeId: masonOnScheme.schemeId,
        enrolledAt: masonOnScheme.enrolledAt,
        status: masonOnScheme.status,
      })
      .from(masonOnScheme)
      .leftJoin(masonPcSide, eq(masonOnScheme.masonId, masonPcSide.id))
      .leftJoin(users, eq(masonPcSide.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(masonOnScheme.enrolledAt))
      .limit(1000);

    const formattedRecords = records.map(record => ({
      ...record,
      enrolledAt: record.enrolledAt ? new Date(record.enrolledAt).toISOString() : null,
    }));

    const validatedRecords = z.array(selectMasonOnSchemeSchema).parse(formattedRecords);

    return NextResponse.json(validatedRecords, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching masons-on-schemes:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}