// src/app/api/dashboardPagesAPI/users-and-team/users/route.ts
import "server-only";
import { connection, NextRequest, NextResponse } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import { db } from "@/lib/drizzle";
import { users, companies } from "../../../../../../drizzle";
import { eq, and, desc } from "drizzle-orm";
import { WorkOS } from "@workos-inc/node";
import { Resend } from "resend";
import { InvitationEmail } from "@/components/InvitationEmail";
import { RESEND_API_KEY } from "@/lib/Reusable-constants";

const allowedAdminRoles = [
    "president",
    "senior-general-manager",
    "general-manager",
    "regional-sales-manager",
    "area-sales-manager",
    "senior-manager",
    "manager",
    "assistant-manager",
];

type AdminUser = {
    id: number;
    workosUserId: string | null;
    email: string;
    role: string;
    companyId: number;
    firstName: string | null;
    lastName: string | null;
    region: string | null;
    area: string | null;
    isTechnicalRole: boolean;
    isAdminAppUser: boolean;
    deviceId: string | null;
    companyName: string | null;
};

const resend = new Resend(RESEND_API_KEY);

export function generateRandomPassword(length: number = 10): string {
    const charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// =======================================================
// EMAIL INVITE FUNCTION (UNCHANGED LOGIC)
// =======================================================

export async function sendInvitationEmailResend({
    to,
    firstName,
    lastName,
    companyName,
    adminName,
    inviteUrl,
    role,
    salesmanLoginId,
    tempPassword,
    techLoginId,
    techTempPassword,
    adminAppLoginId,
    adminAppTempPassword
}: any) {

    try {
        const fromAddress = companyName
            ? `"${companyName}" <noreply@bestcement.co.in>`
            : `noreply@bestcement.co.in`;

        const data = await resend.emails.send({
            from: fromAddress,
            to: [to],
            subject: `You've been invited to join ${companyName}`,
            react: InvitationEmail({
                firstName,
                lastName,
                adminName,
                companyName,
                role,
                inviteUrl,
                salesmanLoginId,
                tempPassword,
                techLoginId,
                techTempPassword,
                adminAppLoginId,
                adminAppTempPassword
            }),
        });

        return data;
    } catch (error) {
        console.error("❌ Resend Error:", error);
    }
}

// =================
// POST ROUTE 
// =================

export async function POST(request: NextRequest) {
    try {
        const workos = new WorkOS(process.env.WORKOS_API_KEY!);
        const claims = await getTokenClaims();

        if (!claims?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = claims.sub;
        const organizationId = claims.org_id as string;

        // =============================
        // FETCH ADMIN USER (DRIZZLE)
        // =============================

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
            .where(eq(users.workosUserId, userId))
            .limit(1);

        const adminUser = adminUserResult[0];

        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'No organization found for admin user.' }, { status: 400 });
        }

        const body = await request.json();
        const { email, firstName, lastName, phoneNumber, role, region, area, isTechnical, isAdminAppUser } = body;

        if (!email || !firstName || !lastName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const workosRole = role.toLowerCase();
        const isTechnicalRole = !!isTechnical;
        const isAdminAppUserRole = !!isAdminAppUser;

        // =============================
        // EXISTING USER CHECK
        // =============================

        const existingUserResult = await db
            .select()
            .from(users)
            .where(and(
                eq(users.companyId, adminUser.companyId),
                eq(users.email, email)
            ))
            .limit(1);

        const existingUser = existingUserResult[0];

        if (existingUser?.workosUserId) {
            return NextResponse.json({ error: 'User with this email already exists and is active' }, { status: 409 });
        }

        if (existingUser?.inviteToken) {
            return NextResponse.json({ error: 'User with this email already has a pending invitation' }, { status: 409 });
        }

        // =============================
        // LOGIN GENERATION (UNCHANGED)
        // =============================

        let salesmanLoginId: string | null = null;
        let tempPasswordPlaintext: string | null = null;
        let hashedPassword = null;

        let techLoginId: string | null = null;
        let techTempPasswordPlaintext: string | null = null;
        let techHashPassword = null;

        let adminAppLoginId: string | null = null;
        let adminAppTempPasswordPlaintext: string | null = null;
        let adminAppHashedPassword = null;

        if ([
            'general-manager','regional-sales-manager','area-sales-manager',
            'senior-manager','manager','assistant-manager',
            'senior-executive','executive','junior-executive'
        ].includes(workosRole)) {

            let isUnique = false;
            while (!isUnique) {
                const generatedId = `EMP-${Math.random().toString(36).substring(2,8).toUpperCase()}`;

                const check = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(eq(users.salesmanLoginId, generatedId))
                    .limit(1);

                if (!check[0]) {
                    salesmanLoginId = generatedId;
                    isUnique = true;
                }
            }

            tempPasswordPlaintext = generateRandomPassword();
            hashedPassword = tempPasswordPlaintext;
        }

        if (isTechnicalRole) {
            let isUnique = false;
            while (!isUnique) {
                const generatedId = `TSE-${Math.random().toString(36).substring(2,8).toUpperCase()}`;

                const check = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(eq(users.techLoginId, generatedId))
                    .limit(1);

                if (!check[0]) {
                    techLoginId = generatedId;
                    isUnique = true;
                }
            }

            techTempPasswordPlaintext = generateRandomPassword();
            techHashPassword = techTempPasswordPlaintext;
        }

        if (isAdminAppUserRole) {
            let isUnique = false;
            while (!isUnique) {
                const generatedId = `ADM-${Math.random().toString(36).substring(2,8).toUpperCase()}`;

                const check = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(eq(users.adminAppLoginId, generatedId))
                    .limit(1);

                if (!check[0]) {
                    adminAppLoginId = generatedId;
                    isUnique = true;
                }
            }

            adminAppTempPasswordPlaintext = generateRandomPassword();
            adminAppHashedPassword = adminAppTempPasswordPlaintext;
        }

        // =============================
        // WORKOS INVITE (UNCHANGED)
        // =============================

        const workosInvitation = await workos.userManagement.sendInvitation({
            email,
            organizationId,
            roleSlug: workosRole
        });

        // =============================
        // INSERT / UPDATE USER (DRIZZLE)
        // =============================

        let newUser;

        if (existingUser) {
            const updated = await db.update(users).set({
                firstName,
                lastName,
                phoneNumber,
                role: workosRole,
                region,
                area,
                status: "pending",
                inviteToken: workosInvitation.id,
                salesmanLoginId,
                hashedPassword,
                isTechnicalRole,
                techLoginId,
                techHashPassword,
                isAdminAppUser: isAdminAppUserRole,
                adminAppLoginId,
                adminAppHashedPassword,
            })
            .where(eq(users.id, existingUser.id))
            .returning();

            newUser = updated[0];

        } else {
            const inserted = await db.insert(users).values({
                email,
                firstName,
                lastName,
                phoneNumber,
                role: workosRole,
                region,
                area,
                workosUserId: null,
                inviteToken: workosInvitation.id,
                companyId: adminUser.companyId,
                status: "pending",
                salesmanLoginId,
                hashedPassword,
                isTechnicalRole,
                techLoginId,
                techHashPassword,
                isAdminAppUser: isAdminAppUserRole,
                adminAppLoginId,
                adminAppHashedPassword,
            }).returning();

            newUser = inserted[0];
        }

        // =============================
        // SEND EMAIL (UNCHANGED)
        // =============================

        await sendInvitationEmailResend({
            to: email,
            firstName,
            lastName,
            companyName: adminUser.companyName ?? "Best Cement",
            adminName: `${adminUser.firstName ?? ''} ${adminUser.lastName ?? ''}`,
            inviteUrl: workosInvitation.acceptInvitationUrl,
            role: workosRole,
            salesmanLoginId,
            tempPassword: tempPasswordPlaintext,
            techLoginId,
            techTempPassword: techTempPasswordPlaintext,
            adminAppLoginId,
            adminAppTempPassword: adminAppTempPasswordPlaintext
        });

        return NextResponse.json({
            message: 'Invitation sent and email delivered successfully',
            user: newUser,
            workosInvitation
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
        const claims = await getTokenClaims();
        if (!claims?.sub)
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = claims.sub;

        const currentUserResult: AdminUser[] = await db
            .select({
                id: users.id,
                workosUserId: users.workosUserId,
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
            .where(eq(users.workosUserId, userId))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser)
            return NextResponse.json({ error: "User not found" }, { status: 404 });

        const url = new URL(request.url);

        if (url.searchParams.get("current") === "true") {
            return NextResponse.json({
                currentUser: {
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