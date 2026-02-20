// src/app/api/dashboardPagesAPI/slm-leaves/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { salesmanLeaveApplicationSchema, updateLeaveApplicationSchema } from '@/lib/shared-zod-schema';
import prisma from '@/lib/prisma';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager'];

// GET /api/dashboardPagesAPI/salesman-leaves
// Fetches all salesman leave applications from the database
export async function GET() {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true } // Optimized selection
    });

    // --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can view leave applications: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    const leaveApplications = await prisma.salesmanLeaveApplication.findMany({
      where: {
        user: { // Access the User relation
          companyId: currentUser.companyId, // Filter by the admin/manager's company
        },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            area: true,
            region: true,
          }
        }, // Include the associated User record to get salesman details
      },
      orderBy: {
        createdAt: 'desc', // Order the results by creation date in descending order
      },
    });

    // Format the data to match the frontend's expected structure
    const formattedApplications = leaveApplications.map((app:any) => {
      // Construct salesmanName from user's firstName and lastName, handling potential nulls
      const salesmanName = [app.user?.firstName, app.user?.lastName]
        .filter(Boolean) // Filters out any null or undefined parts
        .join(' ') || app.user.email || 'N/A'; // Joins remaining parts with a space, defaults to 'N/A' if empty

      return {
        id: app.id,
        salesmanName: salesmanName,
        leaveType: app.leaveType,
        startDate: app.startDate.toISOString().split('T')[0], // Format date to YYYY-MM-DD
        endDate: app.endDate.toISOString().split('T')[0],     // Format date to YYYY-MM-DD
        reason: app.reason,
        status: app.status,
        adminRemarks: app.adminRemarks,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        salesmanRole: app.user.role?? '',
        area: app.user?.area ?? '',
        region: app.user?.region ?? '',
      };
    });

    // 3. Zod Validation for GET response
    const validatedData = z.array(salesmanLeaveApplicationSchema).parse(formattedApplications);

    return NextResponse.json(validatedData, { status: 200 });
  } catch (error) {
    console.error('Error fetching salesman leave applications:', error);
    // Return a 500 status with an error message in case of failure
    return NextResponse.json({ message: 'Failed to fetch leave applications', error: (error as Error).message }, { status: 500 });
  }
}

// PATCH /api/dashboardPagesAPI/salesman-leaves
// Updates the status and remarks of a salesman leave application
export async function PATCH(req: NextRequest) {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to check role and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      include: { company: true }
    });

    // --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can add dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    const body = await req.json();
    const parsedBody = updateLeaveApplicationSchema.safeParse(body); // Validate request body with Zod

    if (!parsedBody.success) {
      // If validation fails, return 400 with detailed errors
      // Accessing parsedBody.error.errors directly, which is the standard Zod error structure
      return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
    }

    const { id, status, adminRemarks } = parsedBody.data;

    // First, verify that the leave application belongs to the current user's company
    const leaveApplicationToUpdate = await prisma.salesmanLeaveApplication.findUnique({
      where: { id: id },
      include: { user: true }
    });

    if (!leaveApplicationToUpdate || leaveApplicationToUpdate.user.companyId !== currentUser.companyId) {
      return NextResponse.json({ message: 'Leave application not found or unauthorized' }, { status: 404 });
    }

    // Construct the data object for Prisma update operation
    // Define an explicit type to ensure correctness for conditional properties
    const updateData: { status: "Approved" | "Rejected"; adminRemarks?: string | null; updatedAt: Date } = {
      status: status,
      updatedAt: new Date(), // Set updated timestamp
    };

    // Conditionally add adminRemarks to updateData.
    // If adminRemarks is undefined (not sent in request), it won't be in updateData,
    // and Prisma will not modify the admin_remarks field in the database.
    // If adminRemarks is null or a string, it will be included and updated.
    if (adminRemarks !== undefined) {
      updateData.adminRemarks = adminRemarks;
    }

    // Update the leave application in the database
    const updatedApplication = await prisma.salesmanLeaveApplication.update({
      where: { id: id }, // Find the record by ID
      data: updateData,  // Apply the constructed update data
      include: {
        user: true, // Include user to return formatted data
      },
    });

    // Format the updated record to match the frontend schema
    const salesmanName = [updatedApplication.user?.firstName, updatedApplication.user?.lastName]
      .filter(Boolean)
      .join(' ') || 'N/A';

    const formattedUpdatedApplication = {
      id: updatedApplication.id,
      salesmanName: salesmanName,
      leaveType: updatedApplication.leaveType,
      startDate: updatedApplication.startDate.toISOString().split('T')[0],
      endDate: updatedApplication.endDate.toISOString().split('T')[0],
      reason: updatedApplication.reason,
      status: updatedApplication.status,
      adminRemarks: updatedApplication.adminRemarks,
    };

    return NextResponse.json(formattedUpdatedApplication); // Return the formatted updated record
  } catch (error: any) {
    if (error.code === 'P2025') { // Prisma error code for record not found
      return NextResponse.json({ message: 'Leave application not found.' }, { status: 404 });
    }
    console.error('Error updating salesman leave application:', error);
    // Return a 500 status with a generic error message
    return NextResponse.json({ message: 'Failed to update leave application', error: error.message }, { status: 500 });
  } finally {
    //await prisma.$disconnect();
  }
}