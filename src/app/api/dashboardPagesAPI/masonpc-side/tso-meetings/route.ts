// src/app/api/dashboardPagesAPI/masonpc-side/tso-meetings/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
// Assuming the schema is in the same shared file
import { tsoMeetingSchema } from '@/lib/shared-zod-schema'; 

// Re-using the allowed roles from your sample. Adjust as needed.
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',];

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
    });

    // 3. Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only allowed roles can access this data.` }, { status: 403 });
    }

    // 4. Fetch TSOMeeting Records
    // We filter by the companyId of the user who created the meeting
    const meetings = await prisma.tSOMeeting.findMany({
      where: {
        createdBy: {
          companyId: currentUser.companyId,
        },
      },
      orderBy: {
        date: 'desc', // Get the most recent meetings first
      },
      take: 1000, 
    });

    // 5. Format the data to match the Zod schema
    const formattedMeetings = meetings.map((meeting: any) => ({
      id: meeting.id,
      createdByUserId: meeting.createdByUserId,
      createdAt: meeting.createdAt.toISOString(),
      updatedAt: meeting.updatedAt.toISOString(),
      date: meeting.date?.toISOString() ?? null,
      type: meeting.type,
      participantsCount: meeting.participantsCount,
      zone: meeting.zone,
      market: meeting.market,
      dealerName: meeting.dealerName,
      dealerAddress: meeting.dealerAddress,
      conductedBy: meeting.conductedBy,
      giftType: meeting.giftType,
      accountJsbJud: meeting.accountJsbJud,
      billSubmitted: meeting.billSubmitted ?? false,
      siteId: meeting.siteId,
      totalExpenses: meeting.totalExpenses?.toNumber() ?? null,

      creatorName: `${meeting.createdBy?.firstName ?? ''} ${meeting.createdBy?.lastName ?? ''}`.trim(),
      role: meeting.createdBy?.role ?? '',
      area: meeting.createdBy?.area ?? '',
      region: meeting.createdBy?.region ?? '',
    }));

    // 6. Validate the data against the Zod schema
    const validatedMeetings = z.array(tsoMeetingSchema).parse(formattedMeetings);

    return NextResponse.json(validatedMeetings, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching TSO meetings data:', error);
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch TSO meetings data' }, { status: 500 });
  } finally {
    // await prisma.$disconnect();
  }
}