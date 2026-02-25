// src/app/api/dashboardPageAPI/assign-tasks/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
// Ensure verifiedDealers is imported here
import { users, dealers, verifiedDealers, dailyTasks } from '../../../../../drizzle/schema';
import { getTableColumns, eq, and, ilike, inArray, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyTaskSchema } from '../../../../../drizzle/zodSchemas';
import crypto from 'crypto'; // Needed to generate the missing IDs

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
  dealerIds: z.array(z.string()).optional().default([]),
}).refine(data => data.dealerIds.length > 0, {
  message: "Select at least one dealer",
});

const apiResponseTaskSchema = selectDailyTaskSchema.extend({
  salesmanName: z.string(),
  relatedDealerName: z.string().nullable().optional(),
});

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

      // 1. Fetch Regular Dealers
      const regularDealersQuery = db
        .select({ id: dealers.id, name: dealers.name, region: dealers.region, area: dealers.area })
        .from(dealers)
        .where(
          and(
            zone && zone !== 'all' ? ilike(dealers.region, `%${zone}%`) : undefined,
            area && area !== 'all' ? ilike(dealers.area, `%${area}%`) : undefined
          )
        );

      // 2. Fetch Verified Dealers (Adding wildcards for safety)
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

      // Execute both simultaneously
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

    // --- Action: Initial Page Load ---
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

    // For the initial page load filters, we also need to get distinct zones/areas from both tables
    const distinctDealers = await db
      .selectDistinct({ region: dealers.region, area: dealers.area })
      .from(dealers)
      .innerJoin(users, eq(dealers.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId));

    const distinctVerifiedDealers = await db
      .selectDistinct({ region: verifiedDealers.zone, area: verifiedDealers.area })
      .from(verifiedDealers);

    const allDistinct = [...distinctDealers, ...distinctVerifiedDealers];
    const uniqueZones = Array.from(new Set(allDistinct.map(d => d.region))).filter(Boolean).sort();
    const uniqueAreas = Array.from(new Set(allDistinct.map(d => d.area))).filter(Boolean).sort();

    const dailyTasksRaw = await db
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
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(dailyTasks.createdAt))
      .limit(200);

    const formattedTasks = dailyTasksRaw.map((task: any) => ({
      ...task,
      salesmanName: `${task.userFirstName || ''} ${task.userLastName || ''}`.trim() || task.userEmail || 'Unknown',
      relatedDealerName: task.dealerNameSnapshot || task.dealerNameFromRelation || 'N/A',
    }));

    const validatedTasks = z.array(apiResponseTaskSchema).safeParse(formattedTasks);

    if (!validatedTasks.success) {
      console.error("Task Validation Error:", validatedTasks.error.format());
    }

    return NextResponse.json({
      salesmen: assignableSalesmen,
      uniqueZones,
      uniqueAreas,
      tasks: validatedTasks.success ? validatedTasks.data : formattedTasks
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

    const { salesmanId, dateRange, dealerIds } = parsedBody.data;

    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const datesToAssign: Date[] = [];

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      datesToAssign.push(new Date(d));
    }

    if (datesToAssign.length === 0) return NextResponse.json({ message: "Invalid date range" }, { status: 400 });

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

      tasksToCreate.push({
        id: crypto.randomUUID(), // <-- Fixes the "null value in column id" error
        userId: salesmanId,
        dealerId: dealer.id,
        dealerNameSnapshot: dealer.name || "Unknown",
        dealerMobile: dealer.mobile || null,
        zone: dealer.region || null,
        area: dealer.area || null,
        taskDate: assignedDate.toISOString().split('T')[0],
        visitType: "Dealer Visit",
        objective: "Bulk assigned via Admin Dashboard",
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