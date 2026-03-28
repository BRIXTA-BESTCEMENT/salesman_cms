// src/app/api/dashboardPagesAPI/users-and-team/users/route.ts
import "server-only";
import { connection, NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth"; // Swapped to your custom auth
import { db } from "@/lib/drizzle";
import { users, companies, roles as rolesTable, userRoles } from "../../../../../../drizzle";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateRandomPassword, sendInvitationEmailResend } from "./helpers";

const allowedAdminRoles = [
    "president", "senior-general-manager", "general-manager",
    "regional-sales-manager", "area-sales-manager", "senior-manager",
    "manager", "assistant-manager", "Admin"
];

// =================
// POST ROUTE 
// =================

export async function POST(request: NextRequest) {
    try {
        // --- 1. ADMIN AUTHORIZATION ---
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminUserResult = await db
            .select({
                id: users.id,
                email: users.email,
                role: users.role,
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

        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // --- 2. PARSE REQUEST DATA ---
        const body = await request.json();
        const { 
            email, firstName, lastName, phoneNumber, role, jobRole, orgRole, region, area, 
            isDashboardUser, isSalesAppUser, isTechnicalRole, isAdminAppUser 
        } = body;

        // jobRole is likely an array now based on your multi-role requirement
        const jobRolesArray = Array.isArray(jobRole) ? jobRole : [jobRole].filter(Boolean);

        if (!email || !firstName || (!orgRole && !role)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // --- 3. EXISTING USER CHECK ---
        const existingUserResult = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.companyId, adminUser.companyId), eq(users.email, email)))
            .limit(1);

        if (existingUserResult[0]) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }

        // --- 4. TRANSACTIONAL INSERT (User + Roles) ---
        const { newUser, emailPayload } = await db.transaction(async (tx) => {
            
            const newUserData: any = {
                email,
                firstName,
                lastName,
                phoneNumber,
                role: orgRole || role,
                region,
                area,
                companyId: adminUser.companyId,
                status: "active",
                isDashboardUser: !!isDashboardUser,
                isSalesAppUser: !!isSalesAppUser,
                isTechnicalRole: !!isTechnicalRole,
                isAdminAppUser: !!isAdminAppUser,
            };

            // Credential Generation Logic
            if (newUserData.isDashboardUser) {
                const dashPassword = generateRandomPassword();
                newUserData.dashboardLoginId = email; 
                newUserData.dashboardHashedPassword = dashPassword;
            }

            if (newUserData.isSalesAppUser) {
                let salesmanId = `EMP-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
                const salesPassword = generateRandomPassword();
                newUserData.salesmanLoginId = salesmanId;
                newUserData.hashedPassword = salesPassword;
            }

            if (newUserData.isTechnicalRole) {
                let techId = `TSE-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
                const techPassword = generateRandomPassword();
                newUserData.techLoginId = techId;
                newUserData.techHashPassword = techPassword;
            }

            if (newUserData.isAdminAppUser) {
                let adminId = `ADM-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
                const adminAppPassword = generateRandomPassword();
                newUserData.adminAppLoginId = adminId;
                newUserData.adminAppHashedPassword = adminAppPassword;
            }

            // A. Insert User
            const inserted = await tx.insert(users).values(newUserData).returning();
            const createdUser = inserted[0];

            // B. Map and Insert Job Roles into userRoles table
            if (jobRolesArray.length > 0) {
                const dbRoles = await tx
                    .select({ id: rolesTable.id })
                    .from(rolesTable)
                    .where(inArray(rolesTable.jobRole, jobRolesArray));

                if (dbRoles.length > 0) {
                    const roleLinks = dbRoles.map(r => ({
                        userId: createdUser.id,
                        roleId: r.id
                    }));
                    await tx.insert(userRoles).values(roleLinks);
                }
            }

            // Prepare Email Payload
            const safeOrgRole = (orgRole || role || '').replace(/-/g, ' ');
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

        // --- 5. SEND EMAIL NOTIFICATION ---
        if (newUser.isDashboardUser || newUser.isSalesAppUser || newUser.isTechnicalRole || newUser.isAdminAppUser) {
            await sendInvitationEmailResend(emailPayload);
        }

        return NextResponse.json({
            message: 'User created and credentials delivered successfully',
            user: newUser
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
    await connection();
    try {
        const session = await verifySession();
        if (!session || !session.userId)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.userId;

        const currentUserResult = await db
            .select({
                id: users.id,
                email: users.email,
                role: users.role,
                companyId: users.companyId,
                firstName: users.firstName,
                lastName: users.lastName,
                region: users.region,
                area: users.area,
                isTechnicalRole: users.isTechnicalRole,
                isAdminAppUser: users.isAdminAppUser,
                deviceId: users.deviceId,
                companyName: companies.companyName,
            })
            .from(users)
            .leftJoin(companies, eq(users.companyId, companies.id))
            .where(eq(users.id, userId))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser)
            return NextResponse.json({ error: "User not found" }, { status: 404 });

        const url = new URL(request.url);

        if (url.searchParams.get("current") === "true") {
            return NextResponse.json({
                currentUser: {
                    id: currentUser.id,
                    role: currentUser.role,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    companyName: currentUser.companyName,
                    region: currentUser.region,
                    area: currentUser.area,
                    isTechnical: currentUser.isTechnicalRole,
                    isAdminAppUser: currentUser.isAdminAppUser,
                    deviceId: currentUser.deviceId,
                },
            });
        }

        if (!allowedAdminRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
            );
        }

        const companyUsers = await db
            .select()
            .from(users)
            .where(eq(users.companyId, currentUser.companyId))
            .orderBy(desc(users.createdAt));

        return NextResponse.json({
            users: companyUsers,
            currentUser: {
                role: currentUser.role,
                companyName: currentUser.companyName,
                region: currentUser.region,
                area: currentUser.area,
                isTechnical: currentUser.isTechnicalRole,
                isAdminAppUser: currentUser.isAdminAppUser,
                deviceId: currentUser.deviceId,
            },
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json(
            { error: "Failed to fetch users" },
            { status: 500 }
        );
    }
}