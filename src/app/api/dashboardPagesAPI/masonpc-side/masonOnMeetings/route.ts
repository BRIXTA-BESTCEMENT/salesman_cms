// src/app/api/dashboardPagesAPI/masonpc-side/masonOnMeetings/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, masonsOnMeetings, masonPcSide } from '../../../../../../drizzle'; 
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
// Use Drizzle-baked schema
import { selectMasonsOnMeetingsSchema } from '../../../../../../drizzle/zodSchemas'; 

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

    // Fetch Records filtered by companyId via Mason -> User relation
    const records = await db
      .select({
        masonId: masonsOnMeetings.masonId,
        meetingId: masonsOnMeetings.meetingId,
        attendedAt: masonsOnMeetings.attendedAt,
      })
      .from(masonsOnMeetings)
      .leftJoin(masonPcSide, eq(masonsOnMeetings.masonId, masonPcSide.id))
      .leftJoin(users, eq(masonPcSide.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(masonsOnMeetings.attendedAt))
      .limit(1000);

    const formattedRecords = records.map(record => ({
      ...record,
      attendedAt: record.attendedAt ? new Date(record.attendedAt).toISOString() : '',
    }));

    const validatedRecords = z.array(selectMasonsOnMeetingsSchema).parse(formattedRecords);

    return NextResponse.json(validatedRecords, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching masons-on-meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}