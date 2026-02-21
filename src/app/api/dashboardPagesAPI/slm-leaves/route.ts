// src/app/api/dashboardPagesAPI/slm-leaves/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, salesmanLeaveApplications } from '../../../../../drizzle'; 
import { eq, desc, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesmanLeaveApplicationSchema, insertSalesmanLeaveApplicationSchema } from '../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'
];

// 1. Extend the baked DB schema to strictly type the joined and formatted fields
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

// 2. Explicit type for stability and potential caching
type LeaveRow = InferSelectModel<typeof salesmanLeaveApplications> & {
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userArea: string | null;
  userRegion: string | null;
};

export async function GET() {
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

    // 3. Flatten the query using getTableColumns
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
      .where(eq(users.companyId, currentUser.companyId))
      .orderBy(desc(salesmanLeaveApplications.createdAt));

    const formattedApplications = results.map((row) => {
      const salesmanName = [row.userFirstName, row.userLastName]
        .filter(Boolean)
        .join(' ') || row.userEmail || 'N/A';

      return {
        ...row,
        salesmanName,
        // Drizzle string dates come as standard ISOs, split to get YYYY-MM-DD
        startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
        endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : '',
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        salesmanRole: row.userRole ?? '',
        area: row.userArea ?? '',
        region: row.userRegion ?? '',
      };
    });

    // 4. Validate against strictly extended schema
    const validatedData = z.array(frontendLeaveSchema).safeParse(formattedApplications);

    if (!validatedData.success) {
      console.error("Leaves GET Validation Error:", validatedData.error.format());
      return NextResponse.json(formattedApplications, { status: 200 }); // Graceful fallback
    }

    return NextResponse.json(validatedData.data, { status: 200 });
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
    
    // Pick specific fields from the insert schema for validation
    const updateLeaveSchema = insertSalesmanLeaveApplicationSchema.pick({
      id: true,
      status: true,
      adminRemarks: true,
    }).required({ id: true }); // Ensure ID is strictly required for the PATCH
    
    const parsedBody = updateLeaveSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { id, status, adminRemarks } = parsedBody.data;

    // Verify ownership and multi-tenancy
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