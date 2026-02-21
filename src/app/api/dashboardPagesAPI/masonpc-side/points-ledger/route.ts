// src/app/api/dashboardPagesAPI/masonpc-side/points-ledger/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache'; 
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, pointsLedger, masonPcSide } from '../../../../../../drizzle'; 
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
// Use Drizzle-baked schema
import { selectPointsLedgerSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

async function getCachedPointsLedger(companyId: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`points-ledger-${companyId}`); 

  const ledgerRecords = await db
    .select({
      ledger: pointsLedger,
      masonName: masonPcSide.name,
    })
    .from(pointsLedger)
    .leftJoin(masonPcSide, eq(pointsLedger.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(eq(users.companyId, companyId))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(1000);

  return ledgerRecords.map(({ ledger, masonName }) => ({
    ...ledger,
    masonName: masonName || 'Unknown Mason',
    createdAt: new Date(ledger.createdAt).toISOString(),
  }));
}

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Insufficient permissions.` }, { status: 403 });
    }

    const formattedReports = await getCachedPointsLedger(currentUser.companyId);
    
    // Use .loose() to allow the joined 'masonName' field
    const validatedReports = z.array(selectPointsLedgerSchema.loose()).parse(formattedReports);

    return NextResponse.json(validatedReports, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching points ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
  }
}