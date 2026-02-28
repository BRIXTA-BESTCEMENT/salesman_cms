// src/app/api/dashboardPageAPI/assign-tasks/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dealers, verifiedDealers, dailyTasks } from '../../../../../drizzle/schema';
import { getTableColumns, eq, and, or, ilike, inArray, desc, asc, count, SQL, gte, lte } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyTaskSchema } from '../../../../../drizzle/zodSchemas';
import crypto from 'crypto'; 

const allowedAssignerRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'
];

const allowedAssigneeRoles = [
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager', 'senior-executive', 'executive', 'junior-executive'
];

const assignSchema = z.object({
  salesmanId: z.number().int(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  dealerDetails: z.array(z.object({
    dealerId: z.string(),
    objective: z.string().optional().default(""),
    visitType: z.string().optional().default("Dealer Visit"),
    requiredVisitCount: z.number().int().optional().default(1),
    route: z.string().optional().default("")
  }))
}).refine(data => data.dealerDetails.length > 0, {
  message: "Select at least one dealer",
});

const apiResponseTaskSchema = selectDailyTaskSchema.extend({
  salesmanName: z.string(),
  relatedDealerName: z.string().nullable().optional(),
});

type DailyTaskRow = InferSelectModel<typeof dailyTasks> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  dealerNameFromRelation: string | null;
};

// --- CACHED FETCH FUNCTION ---
async function getCachedDailyTasks(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  zone: string | null,
  area: string | null,
  salesmanId: string | null,
  status: string | null,
  fromDate: string | null,
  toDate: string | null
) {
  'use cache';
  cacheLife('hours');
  
  const filterKey = `${search}-${zone}-${area}-${salesmanId}-${status}-${fromDate}-${toDate}`;
  cacheTag(`assign-tasks-${companyId}-${page}-${filterKey}`);

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(dailyTasks.dealerNameSnapshot, `%${search}%`),
      ilike(dealers.name, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }
  
  if (zone) filters.push(eq(dailyTasks.zone, zone));
  if (area) filters.push(eq(dailyTasks.area, area));
  if (salesmanId) filters.push(eq(dailyTasks.userId, Number(salesmanId)));
  if (status) filters.push(ilike(dailyTasks.status, status));
  if (fromDate) filters.push(gte(dailyTasks.taskDate, fromDate));
  if (toDate) filters.push(lte(dailyTasks.taskDate, toDate));

  const whereClause = and(...filters);

  const results: DailyTaskRow[] = await db
    .select({
      ...getTableColumns(dailyTasks),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      dealerNameFromRelation: dealers.name,
    })
    .from(dailyTasks)
    .innerJoin(users, eq(dailyTasks.userId, users.id))
    .leftJoin(dealers, eq(dailyTasks.dealerId, dealers.id))
    .where(whereClause)
    .orderBy(desc(dailyTasks.taskDate), desc(dailyTasks.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(dailyTasks)
    .innerJoin(users, eq(dailyTasks.userId, users.id))
    .leftJoin(dealers, eq(dailyTasks.dealerId, dealers.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formattedTasks = results.map((task) => ({
    ...task,
    salesmanName: `${task.userFirstName || ''} ${task.userLastName || ''}`.trim() || task.userEmail || 'Unknown',
    relatedDealerName: task.dealerNameSnapshot || task.dealerNameFromRelation || 'N/A',
  }));

  return { data: formattedTasks, totalCount };
}

export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId, area: users.area, region: users.region })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedAssignerRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // --- Action: Fetch Filtered Dealers ---
    if (action === 'fetch_dealers') {
      const zone = searchParams.get('zone');
      const area = searchParams.get('area');

      const regularDealersQuery = db
        .select({ id: dealers.id, name: dealers.name, region: dealers.region, area: dealers.area })
        .from(dealers)
        .where(
          and(
            zone && zone !== 'all' ? ilike(dealers.region, `%${zone}%`) : undefined,
            area && area !== 'all' ? ilike(dealers.area, `%${area}%`) : undefined
          )
        );

      const verifiedDealersQuery = db
        .select({
          id: verifiedDealers.id,
          name: verifiedDealers.dealerPartyName,
          region: verifiedDealers.zone,
          area: verifiedDealers.area
        })
        .from(verifiedDealers)
        .where(
          and(
            zone && zone !== 'all' ? ilike(verifiedDealers.zone, `%${zone}%`) : undefined,
            area && area !== 'all' ? ilike(verifiedDealers.area, `%${area}%`) : undefined
          )
        );

      const [fetchedRegularDealers, fetchedVerifiedDealers] = await Promise.all([
        regularDealersQuery,
        verifiedDealersQuery
      ]);

      const formattedVerifiedDealers = fetchedVerifiedDealers.map(vd => ({
        id: vd.id.toString(),
        name: vd.name,
        region: vd.region,
        area: vd.area
      }));

      const combinedDealers = [...fetchedRegularDealers, ...formattedVerifiedDealers];
      return NextResponse.json({ dealers: combinedDealers }, { status: 200 });
    }

    // --- Action: Fetch Filters Layout Data ---
    if (action === 'fetch_filters') {
      const assignableSalesmen = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          salesmanLoginId: users.salesmanLoginId,
          area: users.area,
          region: users.region
        })
        .from(users)
        .where(
          and(
            eq(users.companyId, currentUser.companyId),
            inArray(users.role, allowedAssigneeRoles)
          )
        )
        .orderBy(asc(users.firstName));

      const distinctDealers = await db
        .selectDistinct({ region: dealers.region, area: dealers.area })
        .from(dealers)
        .innerJoin(users, eq(dealers.userId, users.id))
        .where(eq(users.companyId, currentUser.companyId));

      const distinctVerifiedDealers = await db
        .selectDistinct({ region: verifiedDealers.zone, area: verifiedDealers.area })
        .from(verifiedDealers);
        
      const distinctStatuses = await db
        .selectDistinct({ status: dailyTasks.status })
        .from(dailyTasks)
        .innerJoin(users, eq(dailyTasks.userId, users.id))
        .where(eq(users.companyId, currentUser.companyId));

      const allDistinct = [...distinctDealers, ...distinctVerifiedDealers];
      const uniqueZones = Array.from(new Set(allDistinct.map(d => d.region))).filter(Boolean).sort();
      const uniqueAreas = Array.from(new Set(allDistinct.map(d => d.area))).filter(Boolean).sort();
      const uniqueStatuses = Array.from(new Set(distinctStatuses.map(s => s.status))).filter(Boolean).sort();

      return NextResponse.json({ salesmen: assignableSalesmen, uniqueZones, uniqueAreas, uniqueStatuses }, { status: 200 });
    }

    // --- Default Action: Fetch Paginated Tasks ---
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const zone = searchParams.get('zone');
    const area = searchParams.get('area');
    const salesmanId = searchParams.get('salesmanId');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const result = await getCachedDailyTasks(
      currentUser.companyId,
      page,
      pageSize,
      search,
      zone,
      area,
      salesmanId,
      status,
      fromDate,
      toDate
    );

    const validatedTasks = z.array(apiResponseTaskSchema).safeParse(result.data);

    if (!validatedTasks.success) {
      console.error("Task Validation Error:", validatedTasks.error.format());
      return NextResponse.json({ data: result.data, totalCount: result.totalCount, page, pageSize }, { status: 200 });
    }

    return NextResponse.json({
      data: validatedTasks.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching assign tasks data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser || !allowedAssignerRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = assignSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid Input', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { salesmanId, dateRange, dealerDetails } = parsedBody.data;

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const datesToAssign: Date[] = [];

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      datesToAssign.push(new Date(d));
    }

    if (datesToAssign.length === 0) return NextResponse.json({ message: "Invalid date range" }, { status: 400 });

    const dealerIds = dealerDetails.map(d => d.dealerId);

    // Separate string UUIDs (Regular Dealers) from numeric Strings (Verified Dealers)
    const numericIds = dealerIds.filter(id => /^\d+$/.test(id)).map(Number);
    const stringIds = dealerIds.filter(id => !/^\d+$/.test(id));

    let regularDealerInfos: any[] = [];
    if (stringIds.length > 0) {
      regularDealerInfos = await db
        .select({
          id: dealers.id,
          name: dealers.name,
          mobile: dealers.phoneNo,
          region: dealers.region,
          area: dealers.area
        })
        .from(dealers)
        .where(inArray(dealers.id, stringIds));
    }

    let verifiedDealerInfos: any[] = [];
    if (numericIds.length > 0) {
      verifiedDealerInfos = await db
        .select({
          id: verifiedDealers.id,
          name: verifiedDealers.dealerPartyName,
          mobile: verifiedDealers.contactNo1,
          region: verifiedDealers.zone,
          area: verifiedDealers.area
        })
        .from(verifiedDealers)
        .where(inArray(verifiedDealers.id, numericIds));
    }

    // Unify them back into one array
    const allDealerInfos = [
      ...regularDealerInfos,
      ...verifiedDealerInfos.map(vd => ({ ...vd, id: vd.id.toString() }))
    ];

    const totalDays = datesToAssign.length;
    const tasksToCreate = [];

    for (let i = 0; i < allDealerInfos.length; i++) {
      const dealer = allDealerInfos[i];
      const assignedDate = datesToAssign[i % totalDays];

      const customConfig = dealerDetails.find(d => d.dealerId === dealer.id);

      tasksToCreate.push({
        id: crypto.randomUUID(),
        userId: salesmanId,
        dealerId: dealer.id,
        dealerNameSnapshot: dealer.name || "Unknown",
        dealerMobile: dealer.mobile || null,
        zone: dealer.region || null,
        area: dealer.area || null,
        taskDate: assignedDate.toISOString().split('T')[0],
        visitType: customConfig?.visitType || "Dealer Visit",
        objective: customConfig?.objective || "Routine check-in",
        requiredVisitCount: customConfig?.requiredVisitCount || 1,
        route: customConfig?.route || null,
        status: "Assigned",
      });
    }

    await db
      .insert(dailyTasks)
      .values(tasksToCreate)
      .onConflictDoNothing();

    return NextResponse.json({
      message: `Successfully distributed tasks across ${totalDays} days.`,
      count: tasksToCreate.length
    }, { status: 201 });

  } catch (error) {
    console.error('Error assigning tasks:', error);
    return NextResponse.json({ error: 'Failed to assign tasks', details: (error as Error).message }, { status: 500 });
  }
}