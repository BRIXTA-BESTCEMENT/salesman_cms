// src/app/api/dashboardPagesAPI/users-and-team/users/app-only/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
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

        const adminUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            include: { company: true }
        });

        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { email, firstName, lastName, phoneNumber, role, region, area, isTechnical } = body;

        if (!email || !firstName || !lastName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if user already exists in this company
        const existingUser = await prisma.user.findUnique({
            where: {
                companyId_email: {
                    companyId: adminUser.companyId,
                    email: email,
                },
            },
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
        }

        // --- Salesman Credentials Generation ---
        let salesmanLoginId: string | null = null;
        let tempPasswordPlaintext = generateRandomPassword();
        
        let isUnique = false;
        while (!isUnique) {
            const generatedId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const collision = await prisma.user.findUnique({ where: { salesmanLoginId: generatedId } });
            if (!collision) {
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
                const collision = await prisma.user.findFirst({ where: { techLoginId: generatedId } });
                if (!collision) {
                    techLoginId = generatedId;
                    isTechUnique = true;
                }
            }
            techTempPasswordPlaintext = generateRandomPassword();
        }

        // --- Create Local User (Skip WorkOS) ---
        const newUser = await prisma.user.create({
            data: {
                email,
                firstName,
                lastName,
                phoneNumber,
                role: role.toLowerCase(),
                region,
                area,
                companyId: adminUser.companyId,
                status: 'active', // Active for App, though no WorkOS ID exists yet
                workosUserId: null, 
                salesmanLoginId,
                hashedPassword: tempPasswordPlaintext, // Storing plaintext as per your current pattern
                isTechnicalRole: !!isTechnical,
                techLoginId,
                techHashedPassword: techTempPasswordPlaintext,
            },
        });

        // --- Send Email ---
        // Note: We pass inviteUrl as an empty string because App-Only users don't have a WorkOS setup link
        try {
            await sendInvitationEmailResend({
                to: email,
                firstName,
                lastName,
                companyName: adminUser.company.companyName,
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