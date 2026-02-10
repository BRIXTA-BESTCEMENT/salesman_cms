// src/app/api/dashboardPagesAPI/users-and-team/users/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { WorkOS } from '@workos-inc/node';
import { Resend } from 'resend';
import { InvitationEmail } from '@/components/InvitationEmail';
import { RESEND_API_KEY } from '@/lib/Reusable-constants';

// Define the roles that have admin-level access
const allowedAdminRoles = [
    'president',
    'senior-general-manager',
    'general-manager',
    'regional-sales-manager',
    'area-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager'
];

const resend = new Resend(RESEND_API_KEY);

// Gmail email sending function - UPDATED
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

        //console.log("✅ Email sent successfully via Resend:", data);
        return data;
    } catch (error) {
        console.error("❌ Resend Error:", error);
        // Don't throw, just log, so the bulk process continues
    }
}

// Function to generate a random password
export function generateRandomPassword(length: number = 10): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}


// POST - Create a new user and send invitation
export async function POST(request: NextRequest) {
    try {
        const workos = new WorkOS(process.env.WORKOS_API_KEY!);
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = claims.sub;
        const organizationId = claims.org_id as string;

        console.log('🔍 Claims:', { userId, organizationId, role: claims.role });

        const adminUser = await prisma.user.findUnique({
            where: { workosUserId: userId },
            include: { company: true }
        });

        // Check if the user's role is in the list of allowed admin roles
        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }


        if (!organizationId) {
            return NextResponse.json({ error: 'No organization found for admin user. Please logout and login again.' }, { status: 400 });
        }

        const body = await request.json();
        const { email, firstName, lastName, phoneNumber, role, region, area, isTechnical, isAdminAppUser } = body;

        // Validate required fields
        if (!email || !firstName || !lastName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // The WorkOS role slug is the same as the user role
        const workosRole = role.toLowerCase();
        const isTechnicalRole = !!isTechnical;
        const isAdminAppUserRole = !!isAdminAppUser;

        const existingUser = await prisma.user.findUnique({
            where: {
                companyId_email: {
                    companyId: adminUser.companyId,
                    email: email,
                },
            },
        });

        if (existingUser) {
            // Check if the existing user is already active in WorkOS
            if (existingUser.workosUserId) {
                return NextResponse.json({ error: 'User with this email already exists and is active' }, { status: 409 });
            }
            // If they have an existing invite, we can't create another
            if (existingUser.inviteToken) {
                return NextResponse.json({ error: 'User with this email already has a pending invitation' }, { status: 409 });
            }
        }

        // --- Salesman Login ---
        let salesmanLoginId: string | null = null;
        let tempPasswordPlaintext: string | null = null;
        let hashedPassword = null;

        // --- Technical Login ---
        let techLoginId: string | null = null;
        let techTempPasswordPlaintext: string | null = null;
        let techHashedPassword = null;

        // --- Admin App Login ---
        let adminAppLoginId: string | null = null;
        let adminAppTempPasswordPlaintext: string | null = null;
        let adminAppHashedPassword = null;


        // 1. Generate salesmanLoginId for executive roles
        if (['general-manager', 'regional-sales-manager', 'area-sales-manager',
            'senior-manager', 'manager', 'assistant-manager',
            'senior-executive', 'executive', 'junior-executive',].includes(workosRole)) {
            let isUnique = false;
            while (!isUnique) {
                const generatedId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const existingSalesman = await prisma.user.findUnique({ where: { salesmanLoginId: generatedId } });
                if (!existingSalesman) {
                    salesmanLoginId = generatedId;
                    isUnique = true;
                }
            }
            tempPasswordPlaintext = generateRandomPassword();
            hashedPassword = tempPasswordPlaintext;
        }

        // 2. Generate techLoginId if 'isTechnical' is true
        if (isTechnicalRole) {
            let isUnique = false;
            while (!isUnique) {
                const generatedId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const existingTechUser = await prisma.user.findUnique({ where: { techLoginId: generatedId } });
                if (!existingTechUser) {
                    techLoginId = generatedId;
                    isUnique = true;
                }
            }
            techTempPasswordPlaintext = generateRandomPassword();
            techHashedPassword = techTempPasswordPlaintext;
        }

        // 3. Generate Admin App Credentials if 'isAdminAppUser' is true  <-- ADDED BLOCK
        if (isAdminAppUserRole) {
            let isUnique = false;
            while (!isUnique) {
                const generatedId = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const existingAdminUser = await prisma.user.findUnique({ where: { adminAppLoginId: generatedId } });
                if (!existingAdminUser) {
                    adminAppLoginId = generatedId;
                    isUnique = true;
                }
            }
            adminAppTempPasswordPlaintext = generateRandomPassword();
            adminAppHashedPassword = adminAppTempPasswordPlaintext;
        }


        // --- CORE LOGIC: Create WorkOS invitation and get the URL ---
        let workosInvitation;
        try {
            console.log('🔄 Creating WorkOS invitation with data:', {
                email,
                organizationId: organizationId,
                roleSlug: workosRole
            });

            // Send invitation with mapped role. This API call returns the invitation object.
            // Remember to disable the default invitation email in the WorkOS dashboard!
            workosInvitation = await workos.userManagement.sendInvitation({
                email: email,
                organizationId: organizationId,
                roleSlug: workosRole
            });

            console.log('✅ Created WorkOS invitation:', {
                id: workosInvitation.id,
                email: workosInvitation.email,
                organizationId: workosInvitation.organizationId,
                state: workosInvitation.state,
                acceptInvitationUrl: workosInvitation.acceptInvitationUrl // This is the key URL!
            });

        } catch (workosError: any) {
            console.error('❌ WorkOS invitation error:', workosError);
            return NextResponse.json({
                error: `Failed to create invitation in WorkOS: ${workosError.message}`
            }, { status: 500 });
        }

        // --- START: MODIFIED INVITATION URL LOGIC ---
        // Construct a custom invitation URL pointing to the new Magic Auth page
        // We use the workosInvitation.id (which acts as the invitation token)
        const customInviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login/magicAuth?email=${encodeURIComponent(email)}&inviteKey=${workosInvitation.id}`;
        // --- END: MODIFIED INVITATION URL LOGIC ---

        // Use the existing user record if it's a new invitation
        let newUser;
        if (existingUser) {
            // Update the existing user's record with the new invitation details
            // This is useful if an invite expired and a new one is sent
            newUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    firstName,
                    lastName,
                    phoneNumber,
                    role: workosRole,
                    region,
                    area,
                    status: 'pending',
                    inviteToken: workosInvitation.id, // Use inviteToken for the workosInvitation ID
                    // Salesman fields
                    salesmanLoginId,
                    hashedPassword,
                    // Technical fields
                    isTechnicalRole,
                    techLoginId,
                    techHashedPassword,
                    // Admin App fields 
                    isAdminAppUser: isAdminAppUserRole,
                    adminAppLoginId,
                    adminAppHashedPassword,
                },
            });
        } else {
            // Create a new user in your local database with a pending status.
            newUser = await prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    phoneNumber,
                    role: workosRole,
                    region,
                    area,
                    workosUserId: null, // The user ID is not yet available
                    inviteToken: workosInvitation.id, // Store the invitation ID
                    companyId: adminUser.companyId,
                    status: 'pending',
                    // Salesman fields
                    salesmanLoginId,
                    hashedPassword,
                    // Technical fields
                    isTechnicalRole,
                    techLoginId,
                    techHashedPassword,
                    // Admin App  
                    isAdminAppUser: isAdminAppUserRole,
                    adminAppLoginId,
                    adminAppHashedPassword,
                },
            });
        }

        console.log('✅ Created/Updated database user with WorkOS Invitation ID:', newUser.id);

        // Send invitation email using Gmail, including the WorkOS URL
        try {
            await sendInvitationEmailResend({
                to: email,
                firstName,
                lastName,
                companyName: adminUser.company.companyName,
                adminName: `${adminUser.firstName} ${adminUser.lastName}`,
                inviteUrl: workosInvitation.acceptInvitationUrl, // google auth setup
                //inviteUrl: customInviteUrl, // magicAuth setup
                role: workosRole,
                salesmanLoginId: salesmanLoginId,
                tempPassword: tempPasswordPlaintext,
                techLoginId: techLoginId,
                techTempPassword: techTempPasswordPlaintext,
                adminAppLoginId: adminAppLoginId,
                adminAppTempPassword: adminAppTempPasswordPlaintext
            });
            console.log(`✅ Invitation email sent to ${email} via Resend`);
        } catch (emailError) {
            console.error('❌ Failed to send invitation email:', emailError);
        }

        return NextResponse.json({
            message: 'Invitation sent and email delivered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                role: newUser.role,
                salesmanLoginId: newUser.salesmanLoginId,
                techLoginId: newUser.techLoginId,
                adminAppLoginId: newUser.adminAppLoginId
            },
            workosInvitation: workosInvitation
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            include: { company: true }
        });
        if (!currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if requesting current user info only
        const url = new URL(request.url);
        if (url.searchParams.get('current') === 'true') {
            return NextResponse.json({
                currentUser: {
                    role: currentUser.role,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    companyName: currentUser.company?.companyName,
                    region: currentUser.region,
                    area: currentUser.area,
                    isTechnical: currentUser.isTechnicalRole,
                    isAdminAppUser: currentUser.isAdminAppUser,
                    deviceId: currentUser.deviceId,
                }
            });
        }
        // Check if the user's role is in the list of allowed admin roles
        if (!allowedAdminRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const users = await prisma.user.findMany({
            where: { companyId: currentUser.companyId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            users,
            currentUser: {
                role: currentUser.role,
                companyName: currentUser.company?.companyName,
                region: currentUser.region,
                area: currentUser.area,
                isTechnical: currentUser.isTechnicalRole,
                isAdminAppUser: currentUser.isAdminAppUser,
                deviceId: currentUser.deviceId,
            }
        });
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}