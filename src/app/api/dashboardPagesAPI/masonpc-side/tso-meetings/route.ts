// src/app/api/dashboardPagesAPI/masonpc-side/tso-meetings/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, tsoMeetings } from '../../../../../../drizzle';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectTsoMeetingSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden` }, { status: 403 });
    }

    // Join with Users (CreatedBy) to filter by companyId
    const meetings = await db
      .select({
        meeting: tsoMeetings,
        creator: {
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          area: users.area,
          region: users.region
        }
      })
      .from(tsoMeetings)
      .innerJoin(users, eq(tsoMeetings.createdByUserId, users.id))
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(tsoMeetings.date))
      .limit(1000);

    const formattedMeetings = meetings.map(({ meeting, creator }) => ({
      ...meeting,
      totalExpenses: meeting.totalExpenses ? Number(meeting.totalExpenses) : null,
      creatorName: `${creator.firstName ?? ''} ${creator.lastName ?? ''}`.trim(),
      role: creator.role ?? '',
      area: creator.area ?? '',
      region: creator.region ?? '',
      createdAt: meeting.createdAt
        ? new Date(meeting.createdAt).toISOString()
        : '',
      updatedAt: meeting.updatedAt
        ? new Date(meeting.updatedAt).toISOString()
        : '',
      date: meeting.date ?? null,
    }));

    // Use .loose() to allow the extra creator metadata fields
    const validatedMeetings = z.array(selectTsoMeetingSchema.loose()).parse(formattedMeetings);

    return NextResponse.json(validatedMeetings, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching TSO meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}