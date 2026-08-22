// src/app/api/dashboardPagesAPI/users-and-team/users/route.ts
import "server-only";
import { connection, NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/drizzle";
import { users, companies, roles as rolesTable, userRoles } from "../../../../../../drizzle";
import { eq, and, desc, inArray, or, ilike, sql } from "drizzle-orm";
import { generateRandomPassword, sendInvitationEmailResend } from "./helpers";

// =================
// POST ROUTE 
// =================
export async function POST(request: NextRequest) {
    if (typeof connection === 'function') await connection();

    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!session.permissions.includes("WRITE")) {
            return NextResponse.json({ error: 'Forbidden: WRITE access required' }, { status: 403 });
        }

        const adminUserResult = await db
            .select({
                id: users.id,
                email: users.email,
                companyId: users.companyId,
                firstName: users.firstName,
                lastName: users.lastName,
                companyName: companies.companyName
            })
            .from(users)
            .leftJoin(companies, eq(users.companyId, companies.id))
            .where(eq(users.id, session.userId))
            .limit(1);

        const adminUser = adminUserResult[0];
        if (!adminUser) return NextResponse.json({ error: 'Admin record not found' }, { status: 404 });

        const body = await request.json();
        const {
            email, firstName, lastName, phoneNumber, jobRole, orgRole, region, area,
            isDashboardUser, isSalesAppUser, isTechnicalRole, isAdminAppUser
        } = body;

        const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean);

        if (!email || !firstName || (!orgRole && !jobRole)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const existingUserResult = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.companyId, adminUser.companyId), eq(users.email, email)))
            .limit(1);

        if (existingUserResult[0]) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }

        const { newUser, emailPayload } = await db.transaction(async (tx) => {
            const newUserData: any = {
                email,
                firstName,
                lastName,
                phoneNumber,
                role: orgRole || 'junior-executive', 
                region,
                area,
                companyId: adminUser.companyId,
                status: "active",
                isDashboardUser: !!isDashboardUser,
                isSalesAppUser: !!isSalesAppUser,
                isTechnicalRole: !!isTechnicalRole,
                isAdminAppUser: !!isAdminAppUser,
            };

            if (newUserData.isDashboardUser) {
                const emailLocalPart = email.split('@')[0];
                let dashPassword = "";
                if (emailLocalPart.includes('.')) {
                    dashPassword = emailLocalPart.split('.')[0] + '@123';
                } else {
                    dashPassword = emailLocalPart.substring(0, 6) + '@123';
                }
                newUserData.dashboardLoginId = email;
                newUserData.dashboardHashedPassword = dashPassword;
            }

            if (newUserData.isSalesAppUser) {
                let salesmanId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const salesPassword = generateRandomPassword();
                newUserData.salesmanLoginId = salesmanId;
                newUserData.hashedPassword = salesPassword;
            }

            if (newUserData.isTechnicalRole) {
                let techId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const techPassword = generateRandomPassword();
                newUserData.techLoginId = techId;
                newUserData.techHashPassword = techPassword;
            }

            if (newUserData.isAdminAppUser) {
                let adminId = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const adminAppPassword = generateRandomPassword();
                newUserData.adminAppLoginId = adminId;
                newUserData.adminAppHashedPassword = adminAppPassword;
            }

            const inserted = await tx.insert(users).values(newUserData).returning();
            const createdUser = inserted[0];

            if (jobRolesArray.length > 0) {
                const dbRoles = await tx
                    .select({ id: rolesTable.id })
                    .from(rolesTable)
                    .where(
                        and(
                            eq(rolesTable.orgRole, newUserData.role),
                            inArray(rolesTable.jobRole, jobRolesArray)
                        )
                    );

                if (dbRoles.length > 0) {
                    const roleLinks = dbRoles.map(r => ({
                        userId: createdUser.id,
                        roleId: r.id
                    }));
                    await tx.insert(userRoles).values(roleLinks);
                }
            }

            const safeOrgRole = (orgRole || '').replace(/-/g, ' ');
            const safeJobRole = jobRolesArray.join(', ').replace(/-/g, ' ');
            const displayRole = safeJobRole ? `${safeOrgRole} (${safeJobRole})` : safeOrgRole;

            const payload = {
                to: email,
                firstName,
                lastName,
                companyName: adminUser.companyName ?? "Best Cement",
                adminName: `${adminUser.firstName ?? ''} ${adminUser.lastName ?? ''}`.trim(),
                role: displayRole,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
                dashboardEmail: newUserData.isDashboardUser ? email : undefined,
                dashboardTempPassword: newUserData.dashboardHashedPassword,
                salesmanLoginId: newUserData.salesmanLoginId,
                salesmanTempPassword: newUserData.hashedPassword,
                techLoginId: newUserData.techLoginId,
                techTempPassword: newUserData.techHashPassword,
                adminAppLoginId: newUserData.adminAppLoginId,
                adminAppTempPassword: newUserData.adminAppHashedPassword
            };

            return { newUser: createdUser, emailPayload: payload };
        });

        if (newUser.isDashboardUser || newUser.isSalesAppUser || newUser.isTechnicalRole || newUser.isAdminAppUser) {
            await sendInvitationEmailResend(emailPayload);
        }

        return NextResponse.json({
            message: 'User created and credentials delivered successfully',
            user: newUser,
            credentials: {
                dashboardEmail: emailPayload.dashboardEmail,
                dashboardPassword: emailPayload.dashboardTempPassword,
                salesmanId: emailPayload.salesmanLoginId,
                salesmanPassword: emailPayload.salesmanTempPassword,
                techId: emailPayload.techLoginId,
                techPassword: emailPayload.techTempPassword,
                adminId: emailPayload.adminAppLoginId,
                adminPassword: emailPayload.adminAppTempPassword
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// =======================================================
// GET
// =======================================================
export async function GET(request: NextRequest) {
  if (typeof connection === 'function') await connection();

  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.permissions.includes('READ')) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const filters = [eq(users.companyId, session.companyId)];

    if (search) {
      filters.push(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.salesmanLoginId, `%${search}%`)
        )!
      );
    }

    const formattedUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        region: users.region,
        area: users.area,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        phoneNumber: users.phoneNumber,
        isTechnicalRole: users.isTechnicalRole,
        isAdminAppUser: users.isAdminAppUser,
        deviceId: users.deviceId,
        isDashboardUser: users.isDashboardUser,
        isSalesAppUser: users.isSalesAppUser,
        salesmanLoginId: users.salesmanLoginId,
        orgRole: sql<string>`COALESCE(MAX(${rolesTable.orgRole}), 'Unassigned')`,
        jobRole: sql<string[]>`COALESCE(array_agg(${rolesTable.jobRole}) FILTER (WHERE ${rolesTable.jobRole} IS NOT NULL), '{}')`
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(rolesTable, eq(userRoles.roleId, rolesTable.id))
      .where(and(...filters))
      // FIX: Explicitly include all selected columns in the group by
      .groupBy(
        users.id,
        users.email,
        users.firstName,
        users.lastName,
        users.region,
        users.area,
        users.status,
        users.createdAt,
        users.updatedAt,
        users.phoneNumber,
        users.isTechnicalRole,
        users.isAdminAppUser,
        users.deviceId,
        users.isDashboardUser,
        users.isSalesAppUser,
        users.salesmanLoginId
      )
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  }
}