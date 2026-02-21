// src/app/api/dashboardPagesAPI/scores-ratings/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, ratings, dealerReportsAndScores, dealers } from '../../../../../drizzle'; 
import { eq, and, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { selectRatingSchema, selectDealerReportsAndScoresSchema } from '../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager', 'senior-executive',
];

// 1. Extend schemas for the frontend
const frontendRatingSchema = selectRatingSchema.extend({
  salesPersonName: z.string(),
});

const frontendDealerScoreSchema = selectDealerReportsAndScoresSchema.extend({
  dealerName: z.string(),
  area: z.string(),
  region: z.string(),
  type: z.string(),
  // Override decimals to strict JS numbers
  dealerScore: z.number().nullable(),
  trustWorthinessScore: z.number().nullable(),
  creditWorthinessScore: z.number().nullable(),
  orderHistoryScore: z.number().nullable(),
  visitFrequencyScore: z.number().nullable(),
  lastUpdatedDate: z.string().nullable(),
});

export async function GET(request: Request) {
  if (typeof connection === 'function') await connection();

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
      return NextResponse.json(
        { error: 'Forbidden: Your role does not have access to this data.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    
    if (!reportType) {
      return NextResponse.json({ error: 'Missing required query parameter: type' }, { status: 400 });
    }

    switch (reportType) {
      case 'salesman': {
        const salesmanRatingsResult = await db
          .select({
            ...getTableColumns(ratings),
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
          })
          .from(ratings)
          .leftJoin(users, eq(ratings.userId, users.id))
          .where(eq(users.companyId, currentUser.companyId));

        const formatted = salesmanRatingsResult.map((row) => ({
          ...row,
          salesPersonName:
            `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'N/A',
        }));

        const validated = z.array(frontendRatingSchema).safeParse(formatted);
        
        if (!validated.success) {
            console.error("Salesman Ratings Validation Error:", validated.error.format());
            return NextResponse.json(formatted, { status: 200 }); // Graceful fallback
        }

        return NextResponse.json(validated.data, { status: 200 });
      }

      case 'dealer': {
        const dealerScoresResult = await db
          .select({
            ...getTableColumns(dealerReportsAndScores),
            dealerNameStr: dealers.name,
            dealerArea: dealers.area,
            dealerRegion: dealers.region,
            dealerTypeStr: dealers.type,
          })
          .from(dealerReportsAndScores)
          .leftJoin(dealers, eq(dealerReportsAndScores.dealerId, dealers.id))
          .leftJoin(users, eq(dealers.userId, users.id)) // Join users via dealer to check companyId
          .where(eq(users.companyId, currentUser.companyId));

        const formatted = dealerScoresResult.map((row) => {
          const toNum = (val: any) => (val ? Number(val) : 0);
          
          return {
            ...row,
            dealerName: row.dealerNameStr || 'Unknown',
            dealerScore: toNum(row.dealerScore),
            trustWorthinessScore: toNum(row.trustWorthinessScore),
            creditWorthinessScore: toNum(row.creditWorthinessScore),
            orderHistoryScore: toNum(row.orderHistoryScore),
            visitFrequencyScore: toNum(row.visitFrequencyScore),
            lastUpdatedDate: row.lastUpdatedDate ? new Date(row.lastUpdatedDate).toISOString().split('T')[0] : null,
            area: row.dealerArea ?? '',
            region: row.dealerRegion ?? '',
            type: row.dealerTypeStr ?? '',
          };
        });

        const validated = z.array(frontendDealerScoreSchema).safeParse(formatted);

        if (!validated.success) {
            console.error("Dealer Scores Validation Error:", validated.error.format());
            return NextResponse.json(formatted, { status: 200 }); // Graceful fallback
        }

        return NextResponse.json(validated.data, { status: 200 });
      }

      default:
        return NextResponse.json({ error: 'Invalid report type specified.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching scores or ratings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: (error as Error).message },
      { status: 500 }
    );
  }
}