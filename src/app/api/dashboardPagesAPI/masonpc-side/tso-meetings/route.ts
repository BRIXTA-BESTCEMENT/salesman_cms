// src/app/api/dashboardPagesAPI/masonpc-side/tso-meetings/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, tsoMeetings } from '../../../../../../drizzle';
import { eq, and, or, ilike, desc, count, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { selectTsoMeetingSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive',
];

const meetingResponseSchema = selectTsoMeetingSchema.loose().extend({
  totalExpenses: z.number().nullable(), 
  creatorName: z.string(),
  role: z.string(),
  area: z.string(),
  region: z.string(),
});

async function getCachedTsoMeetings(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  role: string | null,
  area: string | null,
  region: string | null
) {
  'use cache';
  cacheLife('minutes');
  
  const filterKey = `${search}-${role}-${area}-${region}`;
  cacheTag(`tso-meetings-${companyId}-${page}-${filterKey}`);

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(tsoMeetings.dealerName, `%${search}%`),
      ilike(tsoMeetings.market, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (role && role !== 'all') filters.push(eq(users.role, role));
  if (area && area !== 'all') filters.push(eq(users.area, area));
  if (region && region !== 'all') filters.push(eq(users.region, region));

  const whereClause = and(...filters);

  // 1. Fetch Paginated Data
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
    .where(whereClause)
    .orderBy(desc(tsoMeetings.date), desc(tsoMeetings.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  // 2. Fetch Total Count
  const totalCountResult = await db
    .select({ count: count() })
    .from(tsoMeetings)
    .innerJoin(users, eq(tsoMeetings.createdByUserId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  // 3. Format Data
  const formattedMeetings = meetings.map(({ meeting, creator }) => ({
    ...meeting,
    totalExpenses: meeting.totalExpenses ? Number(meeting.totalExpenses) : null,
    creatorName: `${creator.firstName ?? ''} ${creator.lastName ?? ''}`.trim() || 'Unknown',
    role: creator.role ?? '',
    area: creator.area ?? '',
    region: creator.region ?? '',
    createdAt: meeting.createdAt ?? null,
    updatedAt: meeting.updatedAt ?? null,
    date: meeting.date ?? null,
    meetImageUrl: meeting.meetImageUrl ?? '',
  }));

  return { data: formattedMeetings, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();
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

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const area = searchParams.get('area');
    const region = searchParams.get('region');

    const result = await getCachedTsoMeetings(
      currentUser.companyId,
      page,
      pageSize,
      search,
      role,
      area,
      region
    );

    const validatedMeetings = z.array(meetingResponseSchema).safeParse(result.data);

    if (!validatedMeetings.success) {
      console.error("TSO Meetings Validation Error:", validatedMeetings.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validatedMeetings.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching TSO meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}