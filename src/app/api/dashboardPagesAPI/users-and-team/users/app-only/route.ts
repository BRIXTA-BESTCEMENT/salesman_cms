// src/app/api/dashboardPagesAPI/users-and-team/users/app-only/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../../../../../drizzle';
import { eq, and } from 'drizzle-orm';
import {
    sendInvitationEmailResend,
    generateRandomPassword
} from '@/app/api/dashboardPagesAPI/users-and-team/users/route';

const allowedAdminRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'regional-sales-manager', 'area-sales-manager', 'senior-manager',
    'manager', 'assistant-manager'
];

export async function POST(request: NextRequest) {
    try {
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminUserResult = await db
            .select({
                id: users.id,
                companyId: users.companyId,
                role: users.role,
                firstName: users.firstName,
                lastName: users.lastName,
                companyName: companies.companyName,
            })
            .from(users)
            .leftJoin(companies, eq(users.companyId, companies.id))
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const adminUser = adminUserResult[0];

        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { email, firstName, lastName, phoneNumber, role, region, area, isTechnical } = body;

        if (!email || !firstName || !lastName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists in this company
        const existingUserResult = await db
            .select({ id: users.id })
            .from(users)
            .where(
                and(
                    eq(users.companyId, adminUser.companyId),
                    eq(users.email, email)
                )
            )
            .limit(1);

        const existingUser = existingUserResult[0];

        if (existingUser) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }

        // --- Salesman Credentials Generation ---
        let salesmanLoginId: string | null = null;
        let tempPasswordPlaintext = generateRandomPassword();

        let isUnique = false;
        while (!isUnique) {
            const generatedId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const collision = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.salesmanLoginId, generatedId))
                .limit(1);
            if (!collision[0]) {
                salesmanLoginId = generatedId;
                isUnique = true;
            }
        }

        // --- Technical Credentials (if applicable) ---
        let techLoginId: string | null = null;
        let techTempPasswordPlaintext: string | null = null;

        if (isTechnical) {
            let isTechUnique = false;
            while (!isTechUnique) {
                const generatedId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const collision = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(eq(users.techLoginId, generatedId))
                    .limit(1);
                if (!collision[0]) {
                    techLoginId = generatedId;
                    isTechUnique = true;
                }
            }
            techTempPasswordPlaintext = generateRandomPassword();
        }

        // --- Create Local User (Skip WorkOS) ---
        const result = await db
            .insert(users)
            .values({
                email,
                firstName,
                lastName,
                phoneNumber,
                role: role.toLowerCase(),
                region,
                area,
                companyId: adminUser.companyId,
                status: 'active',
                workosUserId: null,
                salesmanLoginId,
                hashedPassword: tempPasswordPlaintext,
                isTechnicalRole: !!isTechnical,
                techLoginId,
                techHashPassword: techTempPasswordPlaintext,
            })
            .returning();

        const newUser = result[0];

        // --- Send Email ---
        // Note: We pass inviteUrl as an empty string because App-Only users don't have a WorkOS setup link
        try {
            await sendInvitationEmailResend({
                to: email,
                firstName,
                lastName,
                companyName: adminUser.companyName,
                adminName: `${adminUser.firstName} ${adminUser.lastName}`,
                inviteUrl: "", // No dashboard invite link
                role: role.toLowerCase(),
                salesmanLoginId,
                tempPassword: tempPasswordPlaintext,
                techLoginId,
                techTempPassword: techTempPasswordPlaintext
            });
        } catch (emailError) {
            console.error('❌ Failed to send App-Only credentials email:', emailError);
        }

        return NextResponse.json({
            message: 'App-Only user created successfully',
            user: newUser
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating app-only user:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}