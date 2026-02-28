// src/app/api/dashboardPagesAPI/slm-leaves/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { refreshCompanyCache } from '@/app/actions/cache';
import { db } from '@/lib/drizzle';
import { users, salesmanLeaveApplications } from '../../../../../drizzle'; 
import { eq, and, or, ilike, gte, lte, desc, getTableColumns, count, SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesmanLeaveApplicationSchema, insertSalesmanLeaveApplicationSchema } from '../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'
];

const frontendLeaveSchema = selectSalesmanLeaveApplicationSchema.extend({
  salesmanName: z.string(),
  salesmanRole: z.string(),
  area: z.string(),
  region: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type LeaveRow = InferSelectModel<typeof salesmanLeaveApplications> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
};

async function getCachedLeaves(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  role: string | null,
  area: string | null,
  region: string | null,
  startDateParam: string | null,
  endDateParam: string | null
) {
  'use cache';
  cacheLife('hours');
  
  const filterKey = `${search}-${role}-${area}-${region}-${startDateParam}-${endDateParam}`;
  cacheTag(`salesman-leaves-${companyId}-${page}-${filterKey}`);
  cacheTag(`salesman-leaves-${companyId}`); // Broad tag for simple invalidation

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(salesmanLeaveApplications.reason, `%${search}%`),
      ilike(salesmanLeaveApplications.leaveType, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (role && role !== 'all') filters.push(eq(users.role, role));
  if (area && area !== 'all') filters.push(eq(users.area, area));
  if (region && region !== 'all') filters.push(eq(users.region, region));

  if (startDateParam) {
    const start = new Date(startDateParam);
    const end = endDateParam ? new Date(endDateParam) : new Date(startDateParam);
    end.setHours(23, 59, 59, 999);

    // Filter by the startDate of the leave overlapping the selected range
    filters.push(gte(salesmanLeaveApplications.startDate, start.toISOString()));
    filters.push(lte(salesmanLeaveApplications.startDate, end.toISOString()));
  }

  const whereClause = and(...filters);

  const results: LeaveRow[] = await db
    .select({
      ...getTableColumns(salesmanLeaveApplications),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userRole: users.role,
      userArea: users.area,
      userRegion: users.region,
    })
    .from(salesmanLeaveApplications)
    .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
    .where(whereClause)
    .orderBy(desc(salesmanLeaveApplications.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(salesmanLeaveApplications)
    .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formattedApplications = results.map((row) => {
    const salesmanName = [row.userFirstName, row.userLastName]
      .filter(Boolean)
      .join(' ') || row.userEmail || 'N/A';

    return {
      ...row,
      salesmanName,
      startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
      endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : '',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      salesmanRole: row.userRole ?? '',
      area: row.userArea ?? '',
      region: row.userRegion ?? '',
    };
  });

  return { data: formattedApplications, totalCount };
}

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: `Forbidden: Insufficient permissions.` }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const result = await getCachedLeaves(
      currentUser.companyId,
      page,
      pageSize,
      search,
      role,
      area,
      region,
      startDateParam,
      endDateParam
    );

    const validatedData = z.array(frontendLeaveSchema).safeParse(result.data);

    if (!validatedData.success) {
      console.error("Leaves GET Validation Error:", validatedData.error.format());
      return NextResponse.json({
        data: result.data,
        totalCount: result.totalCount,
        page,
        pageSize
      }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validatedData.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json({ message: 'Failed to fetch leave applications', error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
      return NextResponse.json({ error: `Forbidden: Insufficient permissions.` }, { status: 403 });
    }

    const body = await req.json();
    
    const updateLeaveSchema = insertSalesmanLeaveApplicationSchema.pick({
      id: true,
      status: true,
      adminRemarks: true,
    }).required({ id: true }); 
    
    const parsedBody = updateLeaveSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { id, status, adminRemarks } = parsedBody.data;

    const existingApp = await db
      .select({ companyId: users.companyId })
      .from(salesmanLeaveApplications)
      .leftJoin(users, eq(salesmanLeaveApplications.userId, users.id))
      .where(eq(salesmanLeaveApplications.id, id)) 
      .limit(1);

    if (!existingApp[0] || existingApp[0].companyId !== currentUser.companyId) {
      return NextResponse.json({ message: 'Leave application not found or unauthorized' }, { status: 404 });
    }

    const updatedResult = await db
      .update(salesmanLeaveApplications)
      .set({
        status: status as string,
        adminRemarks: adminRemarks ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(salesmanLeaveApplications.id, id))
      .returning();

    const app = updatedResult[0];

    // Invalidate Cache so dashboard reflects the approval immediately
    // revalidateTag(`salesman-leaves-${currentUser.companyId}`, 'max');
    await refreshCompanyCache(`salesman-leaves`);

    return NextResponse.json({
      id: app.id,
      status: app.status,
      adminRemarks: app.adminRemarks,
      updatedAt: app.updatedAt,
    });
  } catch (error: any) {
    console.error('Error updating leave:', error);
    return NextResponse.json({ message: 'Failed to update leave application', error: error.message }, { status: 500 });
  }
}