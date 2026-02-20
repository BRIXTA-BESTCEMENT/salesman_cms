// src/app/api/dashboardPagesAPI/assign-tasks/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { dailyTaskSchema } from '@/lib/shared-zod-schema';

const allowedAssignerRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'];

  const allowedAssigneeRoles = ['assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager', 'senior-executive', 'executive', 'junior-executive',];

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

export async function GET(request: NextRequest) {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true, area: true, region: true },
    });

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

      let regularDealers: any[] = [];
      let verifiedDealers: any[] = [];

      // 1. Fetch Regular Dealers (Case-Insensitive)
      if (type === 'all' || type === 'regular') {
        regularDealers = await prisma.dealer.findMany({
          where: {
            user: { companyId: currentUser.companyId },
            ...(zone && zone !== 'all' && { region: { equals: zone, mode: 'insensitive' } }),
            ...(area && area !== 'all' && { area: { equals: area, mode: 'insensitive' } }),
          },
          select: { id: true, name: true, region: true, area: true }
        });
      }

      // 2. Fetch Verified Dealers (Case-Insensitive AND allows null users)
      if (type === 'all' || type === 'verified') {
        verifiedDealers = await prisma.verifiedDealer.findMany({
          where: {
            OR: [
              { userId: null },
              { user: { companyId: currentUser.companyId } }
            ],
            ...(zone && zone !== 'all' && { zone: { equals: zone, mode: 'insensitive' } }),
            ...(area && area !== 'all' && { area: { equals: area, mode: 'insensitive' } }),
          },
          select: { id: true, dealerPartyName: true, zone: true, area: true }
        });
      }

      // Format them into a unified structure for the frontend MultiSelect
      const combinedDealers = [
        ...regularDealers.map(d => ({
          id: d.id,
          name: d.name,
          region: d.region,
          area: d.area,
          isVerified: false
        })),
        ...verifiedDealers.map(d => ({
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
    const assignableSalesmen = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        role: { in: allowedAssigneeRoles },
      },
      select: { id: true, firstName: true, lastName: true, email: true, salesmanLoginId: true, area: true, region: true },
      orderBy: { firstName: 'asc' },
    });

    // Extract unique regions and areas efficiently to populate frontend dropdowns
    const distinctRegular = await prisma.dealer.findMany({
      where: { user: { companyId: currentUser.companyId } },
      select: { region: true, area: true },
      distinct: ['region', 'area']
    });

    const distinctVerified = await prisma.verifiedDealer.findMany({
      where: { user: { companyId: currentUser.companyId } },
      select: { zone: true, area: true },
      distinct: ['zone', 'area']
    });

    const uniqueZones = Array.from(new Set([
      ...distinctRegular.map(d => d.region),
      ...distinctVerified.map(d => d.zone)
    ])).filter(Boolean).sort();

    const uniqueAreas = Array.from(new Set([
      ...distinctRegular.map(d => d.area),
      ...distinctVerified.map(d => d.area)
    ])).filter(Boolean).sort();

    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        user: { companyId: currentUser.companyId },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        assignedBy: { select: { firstName: true, lastName: true, email: true } },
        relatedDealer: { select: { name: true } },
        relatedVerifiedDealer: { select: { dealerPartyName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const formattedTasks = dailyTasks.map((task: any) => ({
      id: task.id,
      salesmanName: `${task.user.firstName || ''} ${task.user.lastName || ''}`.trim() || task.user.email,
      assignedByUserName: `${task.assignedBy.firstName || ''} ${task.assignedBy.lastName || ''}`.trim() || task.assignedBy.email,
      taskDate: task.taskDate.toISOString().split('T')[0],
      visitType: task.visitType,
      relatedDealerName: task.relatedVerifiedDealer?.dealerPartyName || task.relatedDealer?.name || task.dealerName || 'N/A',
      siteName: task.siteName || null,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt.toISOString(),
    }));

    const validatedTasks = z.array(dailyTaskSchema).safeParse(formattedTasks);

    return NextResponse.json({
      salesmen: assignableSalesmen,
      uniqueZones,
      uniqueAreas,
      tasks: validatedTasks.success ? validatedTasks.data : []
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

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true }
    });

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

    // --- Pre-fetch Names for Snapshots ---
    const regularInfos = regularDealerIds.length > 0 ? await prisma.dealer.findMany({
      where: { id: { in: regularDealerIds } }, select: { id: true, name: true }
    }) : [];

    const verifiedInfos = verifiedDealerIds.length > 0 ? await prisma.verifiedDealer.findMany({
      where: { id: { in: verifiedDealerIds } }, select: { id: true, dealerPartyName: true }
    }) : [];

    // Combine all selected dealers into a single flat array for distribution
    const allSelectedDealers = [
      ...regularInfos.map(d => ({ id: d.id, name: d.name, type: 'regular' })),
      ...verifiedInfos.map(d => ({ id: d.id, name: d.dealerPartyName, type: 'verified' }))
    ];

    // --- Smart Distribution Logic ---
    // If we have 20 dealers and 5 days, we assign 4 dealers per day.
    const totalDays = datesToAssign.length;
    const tasksToCreate = [];

    for (let i = 0; i < allSelectedDealers.length; i++) {
      const dealer = allSelectedDealers[i];
      // Modulo operator cleanly wraps around the dates array, distributing evenly
      const assignedDate = datesToAssign[i % totalDays];

      tasksToCreate.push({
        userId: salesmanId,
        assignedByUserId: currentUser.id,
        taskDate: assignedDate,
        visitType: "Dealer Visit",
        relatedDealerId: dealer.type === 'regular' ? (dealer.id as string) : null,
        relatedVerifiedDealerId: dealer.type === 'verified' ? (dealer.id as number) : null,
        dealerName: dealer.name || "Unknown",
        status: "Assigned",
        description: "Bulk assigned via Admin Dashboard",
      });
    }

    const result = await prisma.dailyTask.createMany({
      data: tasksToCreate,
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `Successfully distributed ${result.count} tasks across ${totalDays} days.`,
      count: result.count
    }, { status: 201 });

  } catch (error) {
    console.error('Error assigning tasks:', error);
    return NextResponse.json({ error: 'Failed to assign tasks', details: (error as Error).message }, { status: 500 });
  }
}