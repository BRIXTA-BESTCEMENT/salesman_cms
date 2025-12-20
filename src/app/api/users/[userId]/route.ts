// src/app/api/users/[userId]/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import * as nodemailer from 'nodemailer'; // <-- ADDED
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { generateRandomPassword } from '@/app/api/users/route';

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

// --- START: COPIED HELPERS (for Email & Password) ---

const EMAIL_TIMEOUT_MS = 12000;

const transportOptions: SMTPTransport.Options = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
  connectionTimeout: 10000,
  greetingTimeout: 7000,
  socketTimeout: 15000,
  // @ts-ignore 
  family: 4,
};

const transporter = nodemailer.createTransport(transportOptions);

async function withTimeout<T>(p: Promise<T>, ms = EMAIL_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('EMAIL_TIMEOUT')), ms)),
  ]);
}

/**
 * NEW, simplified email function just for sending new tech credentials.
 */
export async function sendTechCredentialsEmail({
  to,
  firstName,
  lastName,
  companyName,
  adminName,
  techLoginId,
  techTempPassword,
}: {
  to: string;
  firstName: string;
  lastName: string;
  companyName: string;
  adminName: string;
  techLoginId: string;
  techTempPassword: string;
}) {
  const mailbox = process.env.GMAIL_USER!;

  const technicalDetailsHtml = `
        <p>Your administrator (${adminName}) has created new credentials for the <strong>Technical Team Mobile App</strong>.</p>
        <ul>
          <li><strong>Technical ID (Login ID):</strong>
            <span style="font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; display: inline-block;">${techLoginId}</span>
          </li>
          <li><strong>Temporary Password:</strong>
            <span style="font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; display: inline-block;">${techTempPassword}</span>
          </li>
        </ul>
        <p style="color: #d9534f; font-weight: bold;">Please change this password after your first login to the technical mobile app.</p>
      `;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>Your Technical App Credentials for ${companyName}</title>
      <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0070f3; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      </style>
  </head>
  <body>
      <div class="header">
          <h1>Technical App Credentials Update</h1>
      </div>
      <div class="content">
          <p><strong>Hi ${firstName} ${lastName},</strong></p>
          ${technicalDetailsHtml}
          <p>If you have any questions, please contact your administrator.</p>
          <p><strong>The ${companyName} Team</strong></p>
      </div>
  </body>
  </html>
  `;

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${companyName}" <${mailbox}>`,
    to,
    subject: `Your Technical App Credentials for ${companyName}`,
    html: htmlContent,
    envelope: { from: mailbox, to },
  };

  await withTimeout(transporter.verify(), 6000);
  const info = await withTimeout(transporter.sendMail(mailOptions), EMAIL_TIMEOUT_MS);
  return info;
}

// --- END: COPIED HELPERS ---

const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required.").optional(),
  lastName: z.string().min(1, "Last name is required.").optional(),
  email: z.string().email("Invalid email address.").optional(),
  role: z.string().min(1, "Role is required.").optional(),
  area: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isTechnical: z.boolean().optional(),
  clearDevice: z.boolean().optional()
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

    // Check if the user's role is in the list of allowed admin roles
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
        deviceId: true,
        workosUserId: true,
        createdAt: true,
        updatedAt: true,
        salesmanLoginId: true,
        techLoginId: true,
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
  // FIX: Match the GET signature by explicitly defining params as a Promise
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);

    // FIX: Await params and destructure the userId
    const { userId } = await params;
    const targetUserLocalId = parseInt(userId); // Renamed for clarity in local context

    // We expect a string ID (like UUID or CUID)
    if (!targetUserLocalId) {
      return NextResponse.json({ error: 'User ID is missing from path.' }, { status: 400 });
    }

    const claims = await getTokenClaims();

    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Current User for Authorization
    const adminUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      include: { company: true },
    });

    // Check if the user's role is in the list of allowed admin roles
    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Await request.json() early
    const body = await request.json();
    const parsedBody = updateUserSchema.safeParse(body);

    if (!parsedBody.success) {
      // Zod Validation Failure
      return NextResponse.json(
        { message: 'Invalid request body', errors: parsedBody.error.format() },
        { status: 400 }
      );
    }

    // Destructure data for WorkOS and Prisma updates
    const { role, area, region, phoneNumber, isTechnical, clearDevice, ...workosStandardData } = parsedBody.data;

    // 2. Check if the target user exists and belongs to the same company
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserLocalId },
      select: {
        id: true,
        companyId: true,
        workosUserId: true,
        firstName: true,
        lastName: true,
        email: true,
        techLoginId: true,
        isTechnicalRole: true,
        deviceId: true,
      }
    });

    if (!targetUser || targetUser.companyId !== adminUser.companyId) {
      return NextResponse.json({ error: 'User not found or access denied.' }, { status: 404 });
    }

    // 3. Check for email conflict *only if email is provided and changed*
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

    // 4. Prepare for Concurrent Updates

    // Data for Prisma (includes all fields)
    const prismaUpdateData: any = {
      ...workosStandardData,
      ...(role !== undefined && { role }),
      ...(area !== undefined && { area }),
      ...(region !== undefined && { region }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(clearDevice === true && { deviceId: null }),
      updatedAt: new Date()
    };

    // --- START: New Technical Credential Generation Logic ---
    let emailNotificationPromise: Promise<unknown> = Promise.resolve(); // To hold the email task

    // CHECK: Is admin flipping the switch to TRUE?
    // AND Does the user NOT ALREADY have a tech ID?
    if (isTechnical === true && !targetUser.techLoginId) {
      console.log(`Generating new technical credentials for user ${targetUser.id}`);
      let isUnique = false;
      let newTechLoginId = '';

      while (!isUnique) {
        newTechLoginId = `TSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        // We removed the unique constraint, but checking is still good practice
        const existingTechUser = await prisma.user.findFirst({ where: { techLoginId: newTechLoginId } });
        if (!existingTechUser) {
          isUnique = true;
        }
      }

      const newTechPassword = generateRandomPassword();

      // Add new credentials to the Prisma update
      prismaUpdateData.isTechnicalRole = true;
      prismaUpdateData.techLoginId = newTechLoginId;
      prismaUpdateData.techHashedPassword = newTechPassword; // Storing plaintext as per existing pattern

      // Prepare the email notification
      emailNotificationPromise = sendTechCredentialsEmail({
        to: targetUser.email,
        firstName: (workosStandardData.firstName || targetUser.firstName || ''),
        lastName: (workosStandardData.lastName || targetUser.lastName || ''),
        companyName: adminUser.company.companyName,
        adminName: `${adminUser.firstName} ${adminUser.lastName}`,
        techLoginId: newTechLoginId,
        techTempPassword: newTechPassword
      }).catch(emailError => {
        // Log the error but don't block the API response
        console.error(`Failed to send technical credential email to ${targetUser.email}:`, emailError);
      });

    } else if (isTechnical !== undefined) {
      // Handle simple toggles (e.g., true -> false or just re-affirming true)
      prismaUpdateData.isTechnicalRole = isTechnical;
    }
    // --- END: New Technical Credential Generation Logic ---

    const prismaUpdatePromise = prisma.user.update({
      // Use the local ID (now a string) for the update
      where: { id: targetUserLocalId },
      data: prismaUpdateData
    });

    let workosUpdatePromise;
    let workosUpdateRequired = false;

    // 5. Prepare WorkOS Update Data
    const workosUserUpdateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      customAttributes?: Record<string, string | null>;
    } = { ...workosStandardData };

    const customAttributes: Record<string, string | null> = {};

    // Custom attributes: role, area, region, phoneNumber
    if (role !== undefined) {
      customAttributes.role = role;
      workosUpdateRequired = true;
    }
    if (area !== undefined) {
      customAttributes.area = area;
      workosUpdateRequired = true;
    }
    if (region !== undefined) {
      customAttributes.region = region;
      workosUpdateRequired = true;
    }
    if (phoneNumber !== undefined) {
      customAttributes.phoneNumber = phoneNumber;
      workosUpdateRequired = true;
    }
    if (isTechnical !== undefined) {
      // Convert boolean to string for WorkOS custom attributes
      customAttributes.isTechnical = isTechnical.toString();
      workosUpdateRequired = true;
    }

    // Check if any standard fields (firstName, lastName, email) were provided
    if (Object.keys(workosStandardData).length > 0) {
      workosUpdateRequired = true;
    }

    if (Object.keys(customAttributes).length > 0) {
      workosUserUpdateData.customAttributes = customAttributes;
    }

    // Only proceed with WorkOS update if changes were detected and we have a workosUserId (which is always a string)
    if (workosUpdateRequired && targetUser.workosUserId) {
      workosUpdatePromise = workos.userManagement.updateUser({
        userId: targetUser.workosUserId, // This ID is already a string, as required by WorkOS
        ...workosUserUpdateData,
      });
    } else if (workosUpdateRequired && !targetUser.workosUserId) {
      console.warn(`User ID ${targetUserLocalId} has data changes but is missing WorkOS ID. Skipping WorkOS update.`);
    }

    // Execute both updates concurrently if a WorkOS update is needed
    await Promise.all([
      prismaUpdatePromise,
      workosUpdatePromise,
      emailNotificationPromise,
    ].filter(Boolean));

    return NextResponse.json({
      message: 'User updated successfully',
      user: await prismaUpdatePromise // Return the newly updated user object
    });
  } catch (error: any) {
    console.error('Error updating user:', error);

    // Handle Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    // Note: P2025 is typically for records not found during an update/delete
    if (error.code === 'P2025' || error.name === 'PrismaClientKnownRequestError') {
      // Provide a more generic 404/400 for errors related to ID existence
      return NextResponse.json({ error: 'User not found or database conflict.' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // workos uder deletion happens in api/delete-user/route.ts 
  try {
    const { userId } = await params;

    const claims = await getTokenClaims();

    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
    });

    // Check if the user's role is in the list of allowed admin roles
    if (!adminUser || !allowedAdminRoles.includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Prevent admin from deleting themselves
    const targetUserId = parseInt(userId);
    if (targetUserId === adminUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if user exists and belongs to same company
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: adminUser.companyId
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.user.delete({
      where: {
        id: targetUserId
      }
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);

    // Handle Prisma errors
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
