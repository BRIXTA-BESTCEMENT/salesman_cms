// src/app/api/dashboardPagesAPI/users-and-team/users/[userId]/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { Resend } from 'resend';
import { RESEND_API_KEY } from '@/lib/Reusable-constants';
import { generateRandomPassword, sendInvitationEmailResend } from '@/app/api/dashboardPagesAPI/users-and-team/users/route';

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

/**
 * Helper to send credentials for ANY app role (Tech, Admin, or Salesman updates)
 * Now uses Resend instead of Nodemailer
 */
export async function sendAppCredentialsEmail({
  to,
  firstName,
  companyName,
  adminName,
  credentials
}: {
  to: string;
  firstName: string;
  companyName: string;
  adminName: string;
  credentials: {
    type: 'Technical' | 'Admin' | 'Salesman';
    loginId: string;
    password?: string;
  }[];
}) {
  // Initialize Resend with the imported constant
  const resend = new Resend(RESEND_API_KEY);

  const fromAddress = companyName
    ? `"${companyName}" <noreply@bestcement.co.in>`
    : `noreply@bestcement.co.in`;

  // Build the list of credentials dynamically
  const credentialsHtml = credentials.map(cred => `
    <div style="margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #0070f3; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #333;">${cred.type} App Access</h3>
      <ul style="list-style: none; padding-left: 0;">
        <li><strong>Login ID:</strong> <span style="font-family: monospace; background-color: #e9ecef; padding: 2px 6px; border-radius: 4px;">${cred.loginId}</span></li>
        ${cred.password ? `<li><strong>Password:</strong> <span style="font-family: monospace; background-color: #e9ecef; padding: 2px 6px; border-radius: 4px;">${cred.password}</span></li>` : ''}
      </ul>
    </div>
  `).join('');

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>Your App Credentials for ${companyName}</title>
      <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0070f3; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #ffffff; padding: 30px; border: 1px solid #eaeaea; border-radius: 0 0 8px 8px; }
      </style>
  </head>
  <body>
      <div class="header">
          <h1>New App Credentials</h1>
      </div>
      <div class="content">
          <p><strong>Hi ${firstName},</strong></p>
          <p>Your administrator (${adminName}) has updated your access permissions. Here are your new login details:</p>
          
          ${credentialsHtml}

          <p style="color: #d9534f; font-weight: bold; margin-top: 20px;">Please change any temporary passwords after your first login.</p>
          <p>If you have any questions, please contact your administrator.</p>
          <p><strong>The ${companyName} Team</strong></p>
      </div>
  </body>
  </html>
  `;

  try {
    const data = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Your New App Credentials for ${companyName}`,
      html: htmlContent,
    });
    return data;
  } catch (error) {
    console.error("❌ Resend Error (Credentials Update):", error);
    // Return null or handle error as needed, but don't crash the request
    return null;
  }
}

const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  email: z.string().email("Invalid email address.").optional(),
  role: z.string().min(1, "Role is required.").optional(),
  area: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isTechnical: z.boolean().optional(),
  isAdminAppUser: z.boolean().optional(),
  clearDevice: z.boolean().optional(),
  isDashboardUser: z.boolean().optional()
}).strict();

// GET - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const claims = await getTokenClaims();

    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
    });

    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        companyId: adminUser.companyId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        region: true,
        area: true,
        phoneNumber: true,
        isTechnicalRole: true,
        isAdminAppUser: true,
        deviceId: true,
        workosUserId: true,
        inviteToken: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        salesmanLoginId: true,
        techLoginId: true,
        adminAppLoginId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: targetUser });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const { userId } = await params;
    const targetUserLocalId = parseInt(userId);

    if (!targetUserLocalId) {
      return NextResponse.json({ error: 'User ID is missing from path.' }, { status: 400 });
    }

    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = claims.org_id as string;

    // 1. Fetch Current User for Authorization
    const adminUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      include: { company: true },
    });

    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = updateUserSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsedBody.error.format() },
        { status: 400 }
      );
    }

    const { role, area, region, phoneNumber, isTechnical, isAdminAppUser, clearDevice, isDashboardUser, ...workosStandardData } = parsedBody.data;

    // 2. Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserLocalId },
      select: {
        id: true,
        companyId: true,
        workosUserId: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        salesmanLoginId: true,
        hashedPassword: true,
        techLoginId: true,
        isTechnicalRole: true,
        techHashedPassword: true,
        isAdminAppUser: true,
        adminAppLoginId: true,
        adminAppHashedPassword: true,
        deviceId: true,
      }
    });

    if (!targetUser || targetUser.companyId !== adminUser.companyId) {
      return NextResponse.json({ error: 'User not found or access denied.' }, { status: 404 });
    }

    // 3. Check for email conflict
    if (workosStandardData.email && workosStandardData.email !== targetUser.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: workosStandardData.email,
          companyId: adminUser.companyId,
          id: { not: targetUserLocalId }
        }
      });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already exists for another user in this company' }, { status: 409 });
      }
    }

    // 4. Prepare Updates
    const prismaUpdateData: any = {
      ...workosStandardData,
      ...(role !== undefined && { role }),
      ...(area !== undefined && { area }),
      ...(region !== undefined && { region }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(clearDevice === true && { deviceId: null }),
      updatedAt: new Date()
    };

    let emailNotificationPromises: Promise<any>[] = [];
    const newCredentialsToSend: { type: 'Technical' | 'Admin' | 'Salesman', loginId: string, password?: string }[] = [];

    // --- LOGIC A: Admin App User Update ---
    if (isAdminAppUser === true && !targetUser.adminAppLoginId) {
      console.log(`Generating new Admin App credentials for user ${targetUser.id}`);
      let isUnique = false;
      let newAdminLoginId = '';

      while (!isUnique) {
        newAdminLoginId = `ADM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const existingAdmin = await prisma.user.findFirst({ where: { adminAppLoginId: newAdminLoginId } });
        if (!existingAdmin) isUnique = true;
      }

      const newAdminPassword = generateRandomPassword();

      prismaUpdateData.isAdminAppUser = true;
      prismaUpdateData.adminAppLoginId = newAdminLoginId;
      prismaUpdateData.adminAppHashedPassword = newAdminPassword;

      newCredentialsToSend.push({
        type: 'Admin',
        loginId: newAdminLoginId,
        password: newAdminPassword
      });

    } else if (isAdminAppUser !== undefined) {
      prismaUpdateData.isAdminAppUser = isAdminAppUser;
    }

    // --- LOGIC B: Technical User Update ---
    if (isTechnical === true && !targetUser.techLoginId) {
      console.log(`Generating new Technical credentials for user ${targetUser.id}`);
      let isUnique = false;
      let newTechLoginId = '';

      while (!isUnique) {
        newTechLoginId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const existingTechUser = await prisma.user.findFirst({ where: { techLoginId: newTechLoginId } });
        if (!existingTechUser) isUnique = true;
      }

      const newTechPassword = generateRandomPassword();

      prismaUpdateData.isTechnicalRole = true;
      prismaUpdateData.techLoginId = newTechLoginId;
      prismaUpdateData.techHashedPassword = newTechPassword;

      newCredentialsToSend.push({
        type: 'Technical',
        loginId: newTechLoginId,
        password: newTechPassword
      });

    } else if (isTechnical !== undefined) {
      prismaUpdateData.isTechnicalRole = isTechnical;
    }

    // --- LOGIC C: Salesman/Role Update ---
    const newRole = role || targetUser.role;
    const isSalesmanRole = ['senior-executive', 'executive', 'junior-executive'].includes(newRole);

    if (isSalesmanRole && !targetUser.salesmanLoginId) {
      console.log(`Generating new Salesman credentials due to role change for user ${targetUser.id}`);
      let isUnique = false;
      let newSalesmanId = '';

      while (!isUnique) {
        newSalesmanId = `EMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const existingSalesman = await prisma.user.findUnique({ where: { salesmanLoginId: newSalesmanId } });
        if (!existingSalesman) isUnique = true;
      }

      const newSalesmanPassword = generateRandomPassword();

      prismaUpdateData.salesmanLoginId = newSalesmanId;
      prismaUpdateData.hashedPassword = newSalesmanPassword;

      newCredentialsToSend.push({
        type: 'Salesman',
        loginId: newSalesmanId,
        password: newSalesmanPassword
      });
    }

    // --- EMAIL: Send Consolidated Credential Email via Resend ---
    if (newCredentialsToSend.length > 0) {
      emailNotificationPromises.push(
        sendAppCredentialsEmail({
          to: targetUser.email,
          firstName: (workosStandardData.firstName || targetUser.firstName || 'Team Member'),
          companyName: adminUser.company.companyName,
          adminName: `${adminUser.firstName} ${adminUser.lastName}`,
          credentials: newCredentialsToSend
        })
      );
    }

    // --- LOGIC D: WorkOS Dashboard Access Upgrade ---
    if (isDashboardUser === true && !targetUser.workosUserId && organizationId) {
      console.log(`Dashboard access upgrade triggered for user ${targetUser.id}`);
      try {
        const workosInvitation = await workos.userManagement.sendInvitation({
          email: workosStandardData.email || targetUser.email,
          organizationId: organizationId,
          roleSlug: (role || targetUser.role).toLowerCase()
        });

        prismaUpdateData.inviteToken = workosInvitation.id;
        prismaUpdateData.status = 'pending';

        emailNotificationPromises.push(
          sendInvitationEmailResend({
            to: workosStandardData.email || targetUser.email,
            firstName: workosStandardData.firstName || targetUser.firstName || '',
            lastName: workosStandardData.lastName || targetUser.lastName || '',
            companyName: adminUser.company.companyName,
            adminName: `${adminUser.firstName} ${adminUser.lastName}`,
            inviteUrl: workosInvitation.acceptInvitationUrl,
            role: (role || targetUser.role).toLowerCase(),
            salesmanLoginId: prismaUpdateData.salesmanLoginId || targetUser.salesmanLoginId,
            tempPassword: prismaUpdateData.hashedPassword || targetUser.hashedPassword,
            techLoginId: prismaUpdateData.techLoginId || targetUser.techLoginId,
            techTempPassword: prismaUpdateData.techHashedPassword || targetUser.techHashedPassword
          })
        );
      } catch (err: any) {
        console.error('❌ WorkOS Upgrade failed:', err.message);
      }
    }

    // 5. Execute DB Update
    const prismaUpdatePromise = prisma.user.update({
      where: { id: targetUserLocalId },
      data: prismaUpdateData
    });

    // 6. Execute WorkOS Update
    let workosUpdatePromise;
    let workosUpdateRequired = false;
    const workosUserUpdateData: any = { ...workosStandardData };
    const customAttributes: Record<string, string | null> = {};

    if (role !== undefined) { customAttributes.role = role; workosUpdateRequired = true; }
    if (area !== undefined) { customAttributes.area = area; workosUpdateRequired = true; }
    if (region !== undefined) { customAttributes.region = region; workosUpdateRequired = true; }
    if (phoneNumber !== undefined) { customAttributes.phoneNumber = phoneNumber; workosUpdateRequired = true; }
    if (isTechnical !== undefined) { customAttributes.isTechnical = isTechnical.toString(); workosUpdateRequired = true; }

    if (Object.keys(workosStandardData).length > 0) workosUpdateRequired = true;
    if (Object.keys(customAttributes).length > 0) workosUserUpdateData.customAttributes = customAttributes;

    if (workosUpdateRequired && targetUser.workosUserId) {
      workosUpdatePromise = workos.userManagement.updateUser({
        userId: targetUser.workosUserId,
        ...workosUserUpdateData,
      });
    }

    await Promise.all([
      prismaUpdatePromise,
      workosUpdatePromise,
      ...emailNotificationPromises,
    ].filter(Boolean));

    return NextResponse.json({
      message: 'User updated successfully',
      user: await prismaUpdatePromise
    });

  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error.code === 'P2002') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    if (error.code === 'P2025' || error.name === 'PrismaClientKnownRequestError') return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}