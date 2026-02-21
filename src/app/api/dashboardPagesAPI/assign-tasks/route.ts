// src/app/api/dashboardPagesAPI/assign-tasks/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers, verifiedDealers, dailyTasks } from '../../../../../drizzle/schema'; // Adjust path
import { getTableColumns, eq, and, or, ilike, inArray, isNull, desc, asc, aliasedTable } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyTaskSchema } from '../../../../../drizzle/zodSchemas'; // Using your Drizzle-baked schema

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
  regularDealerIds: z.array(z.string()).optional().default([]),
  verifiedDealerIds: z.array(z.number().int()).optional().default([]),
}).refine(data => data.regularDealerIds.length > 0 || data.verifiedDealerIds.length > 0, {
  message: "Select at least one dealer (Regular or Verified)",
});

// Extend the baked DB schema to include the flattened relational fields for the frontend
const apiResponseTaskSchema = selectDailyTaskSchema.extend({
  salesmanName: z.string(),
  assignedByUserName: z.string(),
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
      const type = searchParams.get('type') || 'all';

      let fetchedRegularDealers: any[] = [];
      let fetchedVerifiedDealers: any[] = [];

      // 1. Fetch Regular Dealers (Case-Insensitive)
      if (type === 'all' || type === 'regular') {
        fetchedRegularDealers = await db
          .select({ id: dealers.id, name: dealers.name, region: dealers.region, area: dealers.area })
          .from(dealers)
          .innerJoin(users, eq(dealers.userId, users.id))
          .where(
            and(
              eq(users.companyId, currentUser.companyId),
              zone && zone !== 'all' ? ilike(dealers.region, zone) : undefined,
              area && area !== 'all' ? ilike(dealers.area, area) : undefined
            )
          );
      }

      // 2. Fetch Verified Dealers (Case-Insensitive AND allows null users)
      if (type === 'all' || type === 'verified') {
        fetchedVerifiedDealers = await db
          .select({ id: verifiedDealers.id, dealerPartyName: verifiedDealers.dealerPartyName, zone: verifiedDealers.zone, area: verifiedDealers.area })
          .from(verifiedDealers)
          .leftJoin(users, eq(verifiedDealers.userId, users.id))
          .where(
            and(
              or(
                isNull(verifiedDealers.userId),
                eq(users.companyId, currentUser.companyId)
              ),
              zone && zone !== 'all' ? ilike(verifiedDealers.zone, zone) : undefined,
              area && area !== 'all' ? ilike(verifiedDealers.area, area) : undefined
            )
          );
      }

      const combinedDealers = [
        ...fetchedRegularDealers.map(d => ({
          id: d.id,
          name: d.name,
          region: d.region,
          area: d.area,
          isVerified: false
        })),
        ...fetchedVerifiedDealers.map(d => ({
          id: d.id,
          name: d.dealerPartyName || 'Unnamed Verified Dealer',
          region: d.zone,
          area: d.area,
          isVerified: true
        }))
      ];

      return NextResponse.json({ dealers: combinedDealers }, { status: 200 });
    }

    // --- Action: Initial Page Load (Salesmen, Tasks, and Filter Dropdowns) ---
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

    const distinctRegular = await db
      .selectDistinct({ region: dealers.region, area: dealers.area })
      .from(dealers)
      .innerJoin(users, eq(dealers.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId));

    const distinctVerified = await db
      .selectDistinct({ zone: verifiedDealers.zone, area: verifiedDealers.area })
      .from(verifiedDealers)
      .innerJoin(users, eq(verifiedDealers.userId, users.id))
      .where(eq(users.companyId, currentUser.companyId));

    const uniqueZones = Array.from(new Set([
      ...distinctRegular.map(d => d.region),
      ...distinctVerified.map(d => d.zone)
    ])).filter(Boolean).sort();

    const uniqueAreas = Array.from(new Set([
      ...distinctRegular.map(d => d.area),
      ...distinctVerified.map(d => d.area)
    ])).filter(Boolean).sort();

    const assignedByUsers = aliasedTable(users, 'assignedByUsers');

    const dailyTasksRaw = await db
      .select({
        ...getTableColumns(dailyTasks),
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        assignedByFirstName: assignedByUsers.firstName,
        assignedByLastName: assignedByUsers.lastName,
        assignedByEmail: assignedByUsers.email,
        dealerName: dealers.name,
        verifiedDealerName: verifiedDealers.dealerPartyName,
      })
      .from(dailyTasks)
      .innerJoin(users, eq(dailyTasks.userId, users.id))
      .leftJoin(assignedByUsers, eq(dailyTasks.assignedByUserId, assignedByUsers.id))
      .leftJoin(dealers, eq(dailyTasks.relatedDealerId, dealers.id))
      .leftJoin(verifiedDealers, eq(dailyTasks.relatedVerifiedDealerId, verifiedDealers.id))
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(dailyTasks.createdAt))
      .limit(200);

    const formattedTasks = dailyTasksRaw.map((task: any) => ({
      ...task,
      salesmanName:
        `${task.userFirstName || ''} ${task.userLastName || ''}`.trim()
        || task.userEmail
        || 'Unknown',
      assignedByUserName:
        `${task.assignedByFirstName || ''} ${task.assignedByLastName || ''}`.trim()
        || task.assignedByEmail
        || 'Unknown',
      relatedDealerName:
        task.verifiedDealerName || task.dealerName || task.dealerName || 'N/A',
    }));

    // Validates against the baked DB schema PLUS our added relational string fields
    const validatedTasks = z.array(apiResponseTaskSchema).safeParse(formattedTasks);

    if (!validatedTasks.success) {
      console.error("Task Validation Error:", validatedTasks.error.format());
    }

    return NextResponse.json({
      salesmen: assignableSalesmen,
      uniqueZones,
      uniqueAreas,
      tasks: validatedTasks.success ? validatedTasks.data : formattedTasks // Fallback so UI doesn't break if strict parse fails
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

    const { salesmanId, dateRange, regularDealerIds, verifiedDealerIds } = parsedBody.data;

    // --- Date Parsing ---
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const datesToAssign: Date[] = [];

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      datesToAssign.push(new Date(d));
    }

    if (datesToAssign.length === 0) return NextResponse.json({ message: "Invalid date range" }, { status: 400 });

    const regularInfos = regularDealerIds.length > 0
      ? await db
        .select({ id: dealers.id, name: dealers.name })
        .from(dealers)
        .where(inArray(dealers.id, regularDealerIds))
      : [];

    const verifiedInfos = verifiedDealerIds.length > 0
      ? await db
        .select({ id: verifiedDealers.id, dealerPartyName: verifiedDealers.dealerPartyName })
        .from(verifiedDealers)
        .where(inArray(verifiedDealers.id, verifiedDealerIds))
      : [];

    const allSelectedDealers = [
      ...regularInfos.map(d => ({ id: d.id, name: d.name, type: 'regular' })),
      ...verifiedInfos.map(d => ({ id: d.id, name: d.dealerPartyName, type: 'verified' }))
    ];

    const totalDays = datesToAssign.length;
    const tasksToCreate = [];

    for (let i = 0; i < allSelectedDealers.length; i++) {
      const dealer = allSelectedDealers[i];
      const assignedDate = datesToAssign[i % totalDays];

      tasksToCreate.push({
        id: crypto.randomUUID(),
        userId: salesmanId,
        assignedByUserId: currentUser.id,
        taskDate: assignedDate.toISOString().split('T')[0], // Match the schema's YYYY-MM-DD mode string
        visitType: "Dealer Visit",
        relatedDealerId: dealer.type === 'regular' ? (dealer.id as string) : null,
        relatedVerifiedDealerId: dealer.type === 'verified' ? (dealer.id as number) : null,
        dealerName: dealer.name || "Unknown",
        status: "Assigned",
        description: "Bulk assigned via Admin Dashboard",
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