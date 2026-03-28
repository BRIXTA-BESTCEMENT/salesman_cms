// src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth'; // Swapped from WorkOS
import { db } from '@/lib/drizzle';
import { users, companies, roles as rolesTable, userRoles } from '../../../../../../../drizzle';
import { eq, and, ne, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { generateRandomPassword, sendInvitationEmailResend } from '@/app/api/dashboardPagesAPI/users-and-team/users/helpers';

const allowedAdminRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'regional-sales-manager', 'area-sales-manager', 'senior-manager',
  'manager', 'assistant-manager', 'Admin'
];

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  orgRole: z.string().optional(),
  jobRole: z.union([z.string(), z.array(z.string())]).optional(), // Support array from frontend
  role: z.string().optional(),
  area: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isDashboardUser: z.boolean().optional(),
  isSalesAppUser: z.boolean().optional(),
  isTechnical: z.boolean().optional(),
  isAdminAppUser: z.boolean().optional(),
  clearDevice: z.boolean().optional(),
}).strict();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const targetUserLocalId = parseInt(userId);

    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUserResult = await db
      .select({
        id: users.id,
        role: users.role,
        companyId: users.companyId,
        firstName: users.firstName,
        lastName: users.lastName,
        companyName: companies.companyName,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, session.userId))
      .limit(1);

    const adminUser = adminUserResult[0];
    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = updateUserSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ message: 'Invalid body', errors: parsedBody.error.format() }, { status: 400 });
    }

    const {
      role, orgRole, jobRole, area, region, phoneNumber, clearDevice,
      isDashboardUser, isSalesAppUser, isTechnical, isAdminAppUser,
      ...standardData
    } = parsedBody.data;

    const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean) as string[];

    const targetUserResult = await db.select().from(users).where(eq(users.id, targetUserLocalId)).limit(1);
    const targetUser = targetUserResult[0];

    if (!targetUser || targetUser.companyId !== adminUser.companyId) {
      return NextResponse.json({ error: 'User not found or access denied.' }, { status: 404 });
    }

    // --- TRANSACTION START ---
    const { updatedUser, emailPayload, sendEmailFlag } = await db.transaction(async (tx) => {

      const drizzleUpdateData: any = {
        ...standardData,
        role: orgRole || role || targetUser.role,
        area: area !== undefined ? area : targetUser.area,
        region: region !== undefined ? region : targetUser.region,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : targetUser.phoneNumber,
        deviceId: clearDevice === true ? null : targetUser.deviceId,
        updatedAt: new Date()
      };

      let needsEmail = false;
      const payload: any = {
        to: standardData.email || targetUser.email,
        firstName: standardData.firstName || targetUser.firstName || 'Team Member',
        companyName: adminUser.companyName ?? 'Best Cement',
        adminName: `${adminUser.firstName} ${adminUser.lastName}`,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      };

      // --- LOGIC A: Dashboard User Upgrade ---
      if (isDashboardUser === true && !targetUser.dashboardHashedPassword) {
        const dashPassword = generateRandomPassword();
        drizzleUpdateData.isDashboardUser = true;
        drizzleUpdateData.dashboardLoginId = standardData.email || targetUser.email;
        drizzleUpdateData.dashboardHashedPassword = dashPassword;
        emailPayload.dashboardEmail = drizzleUpdateData.dashboardLoginId;
        emailPayload.dashboardTempPassword = dashPassword;
        needsEmail = true;
      } else if (isDashboardUser !== undefined) {
        drizzleUpdateData.isDashboardUser = isDashboardUser;
      }

      // --- LOGIC B: Sales App Upgrade ---
      if (isSalesAppUser === true && !targetUser.salesmanLoginId) {
        let isUnique = false;
        let newSalesmanId = '';
        while (!isUnique) {
          newSalesmanId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const existingSalesman = await db.select({ id: users.id }).from(users).where(eq(users.salesmanLoginId, newSalesmanId)).limit(1);
          if (!existingSalesman[0]) isUnique = true;
        }
        const newSalesmanPassword = generateRandomPassword();
        drizzleUpdateData.isSalesAppUser = true;
        drizzleUpdateData.salesmanLoginId = newSalesmanId;
        drizzleUpdateData.hashedPassword = newSalesmanPassword;
        emailPayload.salesmanLoginId = newSalesmanId;
        emailPayload.salesmanTempPassword = newSalesmanPassword;
        needsEmail = true;
      } else if (isSalesAppUser !== undefined) {
        drizzleUpdateData.isSalesAppUser = isSalesAppUser;
      }

      // --- LOGIC C: Technical App Upgrade ---
      if (isTechnical === true && !targetUser.techLoginId) {
        let isUnique = false;
        let newTechLoginId = '';
        while (!isUnique) {
          newTechLoginId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const existing = await db.select({ id: users.id }).from(users).where(eq(users.techLoginId, newTechLoginId)).limit(1);
          if (!existing[0]) isUnique = true;
        }
        const newTechPassword = generateRandomPassword();
        drizzleUpdateData.isTechnicalRole = true;
        drizzleUpdateData.techLoginId = newTechLoginId;
        drizzleUpdateData.techHashPassword = newTechPassword;
        emailPayload.techLoginId = newTechLoginId;
        emailPayload.techTempPassword = newTechPassword;
        needsEmail = true;
      } else if (isTechnical !== undefined) {
        drizzleUpdateData.isTechnicalRole = isTechnical;
      }

      // --- LOGIC D: Admin App Upgrade ---
      if (isAdminAppUser === true && !targetUser.adminAppLoginId) {
        let isUnique = false;
        let newAdminLoginId = '';
        while (!isUnique) {
          newAdminLoginId = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.adminAppLoginId, newAdminLoginId)).limit(1);
          if (!existingAdmin[0]) isUnique = true;
        }
        const newAdminPassword = generateRandomPassword();
        drizzleUpdateData.isAdminAppUser = true;
        drizzleUpdateData.adminAppLoginId = newAdminLoginId;
        drizzleUpdateData.adminAppHashedPassword = newAdminPassword;
        emailPayload.adminAppLoginId = newAdminLoginId;
        emailPayload.adminAppTempPassword = newAdminPassword;
        needsEmail = true;
      } else if (isAdminAppUser !== undefined) {
        drizzleUpdateData.isAdminAppUser = isAdminAppUser;
      }

      // 1. Sync Job Roles in user_roles table
      if (jobRole !== undefined) {
        // Delete existing links
        await tx.delete(userRoles).where(eq(userRoles.userId, targetUserLocalId));

        // Insert new links
        if (jobRolesArray.length > 0) {
          const dbRoles = await tx.select({ id: rolesTable.id }).from(rolesTable).where(inArray(rolesTable.jobRole, jobRolesArray));
          if (dbRoles.length > 0) {
            await tx.insert(userRoles).values(dbRoles.map(r => ({ userId: targetUserLocalId, roleId: r.id })));
          }
        }
      }

      // 2. Update User Record
      const updated = await tx.update(users).set(drizzleUpdateData).where(eq(users.id, targetUserLocalId)).returning();

      // Format display role for email
      const safeOrgRole = (orgRole || role || targetUser.role || '').replace(/-/g, ' ');
      const safeJobRole = jobRolesArray.length > 0 ? jobRolesArray.join(', ').replace(/-/g, ' ') : '';
      payload.role = safeJobRole ? `${safeOrgRole} (${safeJobRole})` : safeOrgRole;

      return { updatedUser: updated[0], emailPayload: payload, sendEmailFlag: needsEmail };
    });

    if (sendEmailFlag) {
      await sendInvitationEmailResend(emailPayload);
    }

    return NextResponse.json({ message: 'User updated successfully', user: updatedUser });

  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// ==========================================
// GET - Get single user
// ==========================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  await connection();
  try {
    const { userId } = await params;

    const session = await verifySession();

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUserResult = await db
      .select({
        role: users.role,
        companyId: users.companyId
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const adminUser = adminUserResult[0];

    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const targetUserResult = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        region: users.region,
        area: users.area,
        phoneNumber: users.phoneNumber,

        // Include new access flags in the GET response
        isDashboardUser: users.isDashboardUser,
        isSalesAppUser: users.isSalesAppUser,
        isTechnicalRole: users.isTechnicalRole,
        isAdminAppUser: users.isAdminAppUser,

        deviceId: users.deviceId,
        workosUserId: users.workosUserId,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,

        // Logins
        dashboardLoginId: users.dashboardLoginId,
        salesmanLoginId: users.salesmanLoginId,
        techLoginId: users.techLoginId,
        adminAppLoginId: users.adminAppLoginId,
      })
      .from(users)
      .where(
        and(
          eq(users.id, Number(userId)),
          eq(users.companyId, adminUser.companyId)
        )
      )
      .limit(1);

    const targetUser = targetUserResult[0];

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}