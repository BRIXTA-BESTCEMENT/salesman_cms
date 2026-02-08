// src/app/api/dashboardPagesAPI/assign-tasks/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { dailyTaskSchema } from '@/lib/shared-zod-schema';

// --- Roles Configuration ---
const allowedAssignerRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'];

const allowedAssigneeRoles = ['senior-executive', 'junior-executive', 'executive'];

// --- Local Validation Schema for the New Simplified Logic ---
const simplifiedAssignSchema = z.object({
  salesmanId: z.number().int(),
  dateRange: z.object({
    from: z.string().datetime().or(z.string()), // Accept ISO strings
    to: z.string().datetime().or(z.string()),
  }),
  dealerIds: z.array(z.string()).min(1, "Select at least one dealer"),
});

export async function GET() {
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

    // 1. Fetch Assignable Salesmen (with their Area/Region for filtering)
    const assignableSalesmen = await prisma.user.findMany({
      where: {
        companyId: currentUser.companyId,
        role: { in: allowedAssigneeRoles },
        ...(currentUser.area && { area: currentUser.area }),
        ...(currentUser.region && { region: currentUser.region }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        salesmanLoginId: true,
        area: true,   // Needed for frontend filtering
        region: true, // Needed for frontend filtering
      },
      orderBy: { firstName: 'asc' },
    });

    // 2. Fetch Dealers (Include Region/Area for frontend filtering)
    const dealers = await prisma.dealer.findMany({
      where: { user: { companyId: currentUser.companyId } },
      select: {
        id: true,
        name: true,
        type: true,
        area: true,   // Needed for matching
        region: true, // Needed for matching
      },
      orderBy: { name: 'asc' },
    });

    // 3. Fetch Recent Tasks
    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        user: {
          companyId: currentUser.companyId,
          ...(currentUser.area && { area: currentUser.area }),
          ...(currentUser.region && { region: currentUser.region }),
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        assignedBy: { select: { firstName: true, lastName: true, email: true } },
        relatedDealer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Format tasks
    const formattedTasks = dailyTasks.map((task: any) => ({
      id: task.id,
      salesmanName: `${task.user.firstName || ''} ${task.user.lastName || ''}`.trim() || task.user.email,
      assignedByUserName: `${task.assignedBy.firstName || ''} ${task.assignedBy.lastName || ''}`.trim() || task.assignedBy.email,
      taskDate: task.taskDate.toISOString().split('T')[0],
      visitType: task.visitType,
      relatedDealerName: task.relatedDealer?.name || task.dealerName || 'N/A',
      siteName: task.siteName || null,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt.toISOString(),
    }));

    // Use safeParse to avoid crashing if DB data is slightly off schema
    const validatedTasks = z.array(dailyTaskSchema).safeParse(formattedTasks);
    const finalTasks = validatedTasks.success ? validatedTasks.data : [];

    return NextResponse.json({ salesmen: assignableSalesmen, dealers, tasks: finalTasks }, { status: 200 });
  } catch (error) {
    console.error('Error fetching data:', error);
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
    const parsedBody = simplifiedAssignSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid Input', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { salesmanId, dateRange, dealerIds } = parsedBody.data;

    // --- Date Loop Logic ---
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    const datesToAssign: Date[] = [];

    // Normalize time to midnight to avoid issues
    startDate.setUTCHours(0,0,0,0);
    endDate.setUTCHours(0,0,0,0);

    // Populate array of dates
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      datesToAssign.push(new Date(d));
    }

    if (datesToAssign.length === 0) {
      return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
    }

    // --- Pre-fetch Dealer Info for Snapshots ---
    const dealerInfos = await prisma.dealer.findMany({
      where: { id: { in: dealerIds } },
      select: { id: true, name: true, type: true } // Add category/pjpCycle here if they exist in Dealer
    });
    
    const dealerMap = new Map(dealerInfos.map(d => [d.id, d]));

    // --- Bulk Create Transaction ---
    // Prepare the data array in memory
    const tasksToCreate = datesToAssign.flatMap(date => 
      dealerIds.map(dealerId => {
        const dealerData = dealerMap.get(dealerId);
        return {
          userId: salesmanId,
          assignedByUserId: currentUser.id,
          taskDate: date,
          visitType: "Dealer Visit",
          relatedDealerId: dealerId,
          dealerName: dealerData?.name || null,
          status: "Assigned",
          description: "Bulk assigned via PJP planner",
          // Note: id is handled by @default(uuid()) in schema
        };
      })
    );

    // Execute single batch insert
    const result = await prisma.dailyTask.createMany({
      data: tasksToCreate,
      skipDuplicates: true, // Optional: safer for re-runs
    });

    return NextResponse.json({ 
      message: `Successfully assigned ${result.count} tasks.`, 
      count: result.count 
    }, { status: 201 });

  } catch (error) {
    console.error('Error assigning tasks:', error);
    return NextResponse.json({ error: 'Failed to assign tasks', details: (error as Error).message }, { status: 500 });
  }
}