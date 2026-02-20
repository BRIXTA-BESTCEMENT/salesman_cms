// src/app/api/dashboardPagesAPI/masonpc-side/masonOnMeetings/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
// Assuming the schema is in the same shared file
import { masonsOnMeetingsSchema } from '@/lib/shared-zod-schema'; 

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

    // 4. Fetch MasonsOnMeetings Records
    // We filter by the companyId of the user associated with the MASON
    const meetingRecords = await prisma.masonsOnMeetings.findMany({
      where: {
        mason: {
          user: {
            companyId: currentUser.companyId,
          },
        },
      },
      orderBy: {
        attendedAt: 'desc', // Get the most recent attendance records first
      },
      take: 1000, 
    });

    // 5. Format the data to match the Zod schema
    const formattedRecords = meetingRecords.map(record => ({
      masonId: record.masonId,
      meetingId: record.meetingId,
      attendedAt: record.attendedAt.toISOString(), // Convert DateTime to ISO string
    }));

    // 6. Validate the data against the Zod schema
    const validatedRecords = z.array(masonsOnMeetingsSchema).parse(formattedRecords);

    return NextResponse.json(validatedRecords, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching masons-on-meetings data:', error);
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    // Return a 500 status with a generic error message
    return NextResponse.json({ error: 'Failed to fetch masons-on-meetings data' }, { status: 500 });
  } finally {
    // await prisma.$disconnect();
  }
}