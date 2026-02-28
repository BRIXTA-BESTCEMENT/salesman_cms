// src/app/api/dashboardPagesAPI/masonpc-side/points-ledger/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache'; 
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, pointsLedger, masonPcSide } from '../../../../../../drizzle'; 
import { eq, desc, and, or, ilike, count, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { selectPointsLedgerSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

const extendedLedgerSchema = selectPointsLedgerSchema.extend({
  masonName: z.string(),
  createdAt: z.string(),
});

async function getCachedPointsLedger(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  sourceType: string | null
) {
  'use cache';
  cacheLife('minutes');
  
  const filterKey = `${search}-${sourceType}`;
  cacheTag(`points-ledger-${companyId}-${page}-${filterKey}`); 

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(masonPcSide.name, `%${search}%`),
      ilike(pointsLedger.memo, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (sourceType && sourceType !== 'all') {
    filters.push(eq(pointsLedger.sourceType, sourceType));
  }

  const whereClause = and(...filters);

  const ledgerRecords = await db
    .select({
      ledger: pointsLedger,
      masonName: masonPcSide.name,
    })
    .from(pointsLedger)
    .leftJoin(masonPcSide, eq(pointsLedger.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(whereClause)
    .orderBy(desc(pointsLedger.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(pointsLedger)
    .leftJoin(masonPcSide, eq(pointsLedger.masonId, masonPcSide.id))
    .leftJoin(users, eq(masonPcSide.userId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formattedData = ledgerRecords.map(({ ledger, masonName }) => ({
    ...ledger,
    masonName: masonName || 'Unknown Mason',
    createdAt: new Date(ledger.createdAt).toISOString(),
  }));

  return { data: formattedData, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();
  
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

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const sourceType = searchParams.get('sourceType');

    const result = await getCachedPointsLedger(
      currentUser.companyId,
      page,
      pageSize,
      search,
      sourceType
    );
    
    const validatedReports = z.array(extendedLedgerSchema.loose()).safeParse(result.data);

    if (!validatedReports.success) {
      console.error("Points Ledger Validation Error:", validatedReports.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validatedReports.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('Error fetching points ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch data', details: error.message }, { status: 500 });
  }
}