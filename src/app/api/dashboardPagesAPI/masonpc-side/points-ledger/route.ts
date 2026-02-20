// src/app/api/dashboardPagesAPI/masonpc-side/points-ledger/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache'; 
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

const ledgerResponseSchema = z.object({
  id: z.string(),
  masonId: z.string(),
  masonName: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
  points: z.number().int(),
  memo: z.string().nullable(),
  createdAt: z.string(),
});

// Handled on the server, completely isolated from runtime user data
async function getCachedPointsLedger(companyId: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`points-ledger-${companyId}`); 

  const ledgerRecords = await prisma.pointsLedger.findMany({
    where: {
      // Filter records where the associated mason's user belongs to the current user's company
      mason: {
        user: {
          companyId: companyId,
        },
      },
    },
    select: {
      id: true,
      masonId: true,
      sourceType: true,
      sourceId: true,
      points: true,
      memo: true,
      createdAt: true,
      mason: { select: { name: true } }, // Join to get Mason Name
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 1000, // Add a reasonable limit
  });

  // Map and format the data
  return ledgerRecords.map(record => ({
    id: record.id,
    masonId: record.masonId,
    masonName: record.mason.name, // Flattened field
    sourceType: record.sourceType,
    sourceId: record.sourceId ?? null,
    points: record.points,
    memo: record.memo ?? null,
    createdAt: record.createdAt.toISOString(),
  }));
}

// 3. The Route Handler
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
      select: { role: true, companyId: true }
    });

    // 3. Authorization Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only allowed roles can access this data.` }, { status: 403 });
    }

    // 4. Call the purely cached function
    const formattedReports = await getCachedPointsLedger(currentUser.companyId);
    
    // 5. Validate schema
    const validatedReports = z.array(ledgerResponseSchema).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching points ledger data:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to fetch points ledger data' }, { status: 500 });
  }
}