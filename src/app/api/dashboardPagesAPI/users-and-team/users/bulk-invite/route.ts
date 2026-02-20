// src/app/api/dashboardPagesAPI/users-and-team/users/bulk-invite/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { WorkOS } from '@workos-inc/node';
import { 
    sendInvitationEmailResend, 
    generateRandomPassword, 
} from '@/app/api/dashboardPagesAPI/users-and-team/users/route';

const allowedAdminRoles = [
    'president',
    'senior-general-manager',
    'general-manager', 
    'regional-sales-manager',
    'area-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager',
];

// Define the expected structure for a single user in the request body
interface SingleUserPayload {
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role: string;
    region?: string;
    area?: string;
    isTechnical: boolean; // <-- ADDED
}
interface AdminUserWithCompany {
    id: number;
    companyId: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    company: {
        companyName: string;
        // Include any other Company fields accessed (e.g., region, area, id)
    } | null;
}

// Reusable Core Logic for Invitation (Extracted from your original POST handler)
async function processSingleInvitation(
    userPayload: SingleUserPayload,
    adminUser: AdminUserWithCompany,
    organizationId: string
) {
    // NOTE: In a real app, move all imports/setup logic (WorkOS, nodemailer, etc.) 
    // into this function or import them from a utility file to ensure they are available.
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    // --- UPDATED DESTRUCTURING ---
    const { email, firstName, lastName, phoneNumber, role, region, area, isTechnical } = userPayload;

    if (!email || !firstName || !lastName || !role) {
        throw new Error('Missing required fields for one or more users');
    }

    const workosRole = role.toLowerCase();
    const isTechnicalRole = !!isTechnical;
    const companyId = adminUser!.companyId;
    const companyName = adminUser!.company!?.companyName;
    const adminName = `${adminUser!.firstName} ${adminUser!.lastName}`;

    // 1. Check for existing user in DB (using unique constraint on email/companyId)
    const existingUser = await prisma.user.findUnique({
        where: { companyId_email: { companyId, email: email } },
    });

    if (existingUser && existingUser.workosUserId) {
        throw new Error(`User ${email} already exists and is active`);
    }

    // 2. Generate Salesman Credentials (if applicable)
    let salesmanLoginId: string | null = null;
    let tempPasswordPlaintext: string | null = null;
    let hashedPassword = null;

    if (['senior-executive', 'executive', 'junior-executive'].includes(workosRole)) {
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
        // In production, use bcrypt here:
        // hashedPassword = await bcrypt.hash(tempPasswordPlaintext, await bcrypt.genSalt(10));
        hashedPassword = tempPasswordPlaintext; // Placeholder for non-bcrypt hashing
    }

    // --- START: ADDED TECHNICAL CREDENTIAL LOGIC ---
    let techLoginId: string | null = null;
    let techTempPasswordPlaintext: string | null = null;
    let techHashedPassword = null;

    if (isTechnicalRole) {
        let isUnique = false;
        while (!isUnique) {
            const generatedId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            // We removed unique constraint, but checking is still good practice
            const existingTechUser = await prisma.user.findFirst({ where: { techLoginId: generatedId } });
            if (!existingTechUser) {
                techLoginId = generatedId;
                isUnique = true;
            }
        }
        techTempPasswordPlaintext = generateRandomPassword();
        techHashedPassword = techTempPasswordPlaintext;
    }
    // --- END: ADDED TECHNICAL CREDENTIAL LOGIC ---


    // 3. Create WorkOS invitation
    let workosInvitation;
    try {
        workosInvitation = await workos.userManagement.sendInvitation({
            email: email,
            organizationId: organizationId,
            roleSlug: workosRole
        });
    } catch (workosError: any) {
        throw new Error(`WorkOS invitation failed for ${email}: ${workosError.message}`);
    }

    // --- START: MODIFIED INVITATION URL LOGIC ---
    // Construct a custom invitation URL pointing to the new Magic Auth page
    const customInviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login/magicAuth?email=${encodeURIComponent(email)}&token=${workosInvitation.id}`;
    // --- END: MODIFIED INVITATION URL LOGIC ---

    // 4. Create/Update user in your database
    const userData = {
        firstName, 
        lastName, 
        phoneNumber, 
        role: workosRole, 
        region, 
        area,
        status: 'pending',
        inviteToken: workosInvitation.id,
        salesmanLoginId,
        hashedPassword,
        isTechnicalRole, 
        techLoginId, 
        techHashedPassword,
    };
    // --- END UPDATE ---

    let newUser;
    if (existingUser) {
        newUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: userData,
        });
    } else {
        newUser = await prisma.user.create({
            data: { ...userData, email, workosUserId: null, companyId },
        });
    }

    // 5. Send custom invitation email
    try {
        // --- UPDATED: Pass new tech credentials to email function ---
        await sendInvitationEmailResend({
            to: email,
            firstName, 
            lastName, 
            companyName, 
            adminName,
            inviteUrl: workosInvitation.acceptInvitationUrl, // google auth setup
            //inviteUrl: customInviteUrl, // magicAuth setup
            role: workosRole,
            salesmanLoginId: salesmanLoginId,
            tempPassword: tempPasswordPlaintext,
            techLoginId: techLoginId, 
            techTempPassword: techTempPasswordPlaintext 
        });
        // --- END UPDATE ---
    } catch (emailError) {
        console.error(`❌ Failed to send invitation email to ${email}:`, emailError);
    }

    return {
        success: true,
        email,
        message: 'Invitation sent and email delivered successfully',
        salesmanLoginId,
        techLoginId,
    };
}


export async function POST(request: NextRequest) {
    try {
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = claims.sub;
        const organizationId = claims.org_id as string;
        const body = await request.json();

        // The body IS the array of users, as sent by bulkInvite.tsx
        const usersToProcess: SingleUserPayload[] = Array.isArray(body) ? body : [];

        if (usersToProcess.length === 0) {
            return NextResponse.json({ error: 'No user data provided' }, { status: 400 });
        }
        
        // --- ADMIN & ORGANIZATION CHECK ---
        const adminUser = await prisma.user.findUnique({
            where: { workosUserId: userId },
            include: { company: true }
        });

        if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'No WorkOS Organization ID found' }, { status: 400 });
        }

        // --- BULK PROCESSING LOOP ---
        const results = [];
        let hasErrors = false;

        for (const userPayload of usersToProcess) {
            // Frontend parser in bulkInvite.tsx should have validated this,
            // but we do a server-side check for robustness.
            if (userPayload.isTechnical === undefined) {
                hasErrors = true;
                results.push({
                    success: false,
                    email: userPayload.email,
                    error: "Missing 'isTechnical' flag.",
                });
                continue; // Skip this user
            }
            
            try {
                const result = await processSingleInvitation(userPayload, adminUser, organizationId);
                results.push(result);
            } catch (error: any) {
                console.error(`Failed to process invitation for ${userPayload.email || 'N/A'}:`, error.message);
                hasErrors = true;
                results.push({
                    success: false,
                    email: userPayload.email,
                    error: error.message.split(': ')[1] || error.message, // Clean up error message
                });
            }
        }
        
        // Return a summary response
        const successfulCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            message: `Bulk invitation completed: ${successfulCount} successful, ${failedCount} failed.`,
            successfulCount,
            failedCount,
            results,
        }, { status: hasErrors ? 207 : 201 }); // 207 Multi-Status if some failed, 201 if all succeeded

    } catch (error: any) {
        console.error('Error in bulk-invite handler:', error);
        return NextResponse.json({ error: 'An unexpected server error occurred during bulk processing' }, { status: 500 });
    }
}