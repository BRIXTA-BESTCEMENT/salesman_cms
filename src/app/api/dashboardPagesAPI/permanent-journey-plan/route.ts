// src/app/api/dashboardPagesAPI/permanent-journey-plan/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma'; // Ensure this path is correct for your Prisma client
import { z } from 'zod'; // Added Zod Import
import { permanentJourneyPlanSchema } from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive','executive',];

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: `Forbidden: Only the following roles can access PJP data: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus');

    // 4. Construct the WHERE clause (NEW)
    const whereClause: any = {
        user: { 
            companyId: currentUser.companyId,
        },
    };

    // Apply the verification status filter if present
    if (verificationStatus) {
        whereClause.verificationStatus = verificationStatus;
    }


    // 5. Fetch Permanent Journey Plans for the current user's company
    const permanentJourneyPlans = await prisma.permanentJourneyPlan.findMany({
      where: whereClause, // Use the constructed whereClause
      include: {
        // Include salesman details to get their name
        user: { 
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        // Include creator details
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        // Also include the daily tasks associated with the PJP
        dailyTasks: {
          select: {
            id: true,
            status: true,
            visitType: true,
            relatedDealerId: true,
            siteName: true,
          },
        },
        dealer: { select: { name: true } },
        site: { select: { siteName: true } },
      },
      orderBy: {
        planDate: 'desc', // Order by latest plans first
      },
    });

    // Map the data to match the frontend's PermanentJourneyPlan schema
    const formattedPlans = permanentJourneyPlans.map((plan:any) => {
      // Construct salesman and creator names, handling potential nulls
      const salesmanName = `${plan.user.firstName || ''} ${plan.user.lastName || ''}`.trim() || plan.user.email;
      const createdByName = `${plan.createdBy.firstName || ''} ${plan.createdBy.lastName || ''}`.trim() || plan.createdBy.email;
      const taskIds = plan.dailyTasks.map((task:any) => task.id);
      const visitTargetName = plan.dealer?.name ?? plan.site?.siteName ?? null;

      return {
        id: plan.id,
        salesmanName: salesmanName,
        userId: plan.userId,
        createdByName: createdByName,
        createdByRole: plan.createdBy.role,
        areaToBeVisited: plan.areaToBeVisited,
        route: plan.route,
        planDate: plan.planDate.toISOString().split('T')[0],
        description: plan.description,
        status: plan.status,
        plannedNewSiteVisits: plan.plannedNewSiteVisits ?? 0,
        plannedFollowUpSiteVisits: plan.plannedFollowUpSiteVisits ?? 0,
        plannedNewDealerVisits: plan.plannedNewDealerVisits ?? 0,
        plannedInfluencerVisits: plan.plannedInfluencerVisits ?? 0,
        influencerName: plan.influencerName,
        influencerPhone: plan.influencerPhone,
        activityType: plan.activityType,
        noOfConvertedBags: plan.noOfConvertedBags ?? 0,
        noOfMasonPcSchemes: plan.noOfMasonPcSchemes ?? 0,
        diversionReason: plan.diversionReason,
  
        taskIds: taskIds,
        dealerId: plan.dealerId,
        siteId: plan.siteId,
        visitDealerName: visitTargetName,
        verificationStatus: plan.verificationStatus,
        additionalVisitRemarks: plan.additionalVisitRemarks,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      };
    });

    // 3. Zod Validation
    const validatedData = z.array(permanentJourneyPlanSchema).parse(formattedPlans);

    return NextResponse.json(validatedData, { status: 200 });
  } catch (error) {
    console.error('Error fetching permanent journey plans:', error);
    return NextResponse.json({ error: 'Failed to fetch permanent journey plans', details: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE function to remove a Permanent Journey Plan (PJP).
 * This will NOT delete associated Daily Tasks.
 */
export async function DELETE(request: NextRequest) {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Current User to get their ID, role, and companyId
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true },
    });

    // 3. Role-based Authorization
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        {
          error: `Forbidden: Only the following roles can delete PJPs: ${allowedRoles.join(
            ', ',
          )}`,
        },
        { status: 403 },
      );
    }

    // 4. Extract pjpId from the query parameters
    const url = new URL(request.url);
    const pjpId = url.searchParams.get('id');

    if (!pjpId) {
      return NextResponse.json({ error: 'Missing PJP ID in request' }, { status: 400 });
    }

    // 5. Verify the PJP exists and belongs to the current user's company (multi-tenancy check)
    const pjpToDelete = await prisma.permanentJourneyPlan.findUnique({
      where: { id: pjpId },
      include: {
        user: {
          select: { companyId: true }, // Select the related user's companyId for tenancy check
        },
      },
    });

    if (!pjpToDelete) {
      return NextResponse.json(
        { error: 'Permanent Journey Plan not found' },
        { status: 404 },
      );
    }

    // This checks if the PJP's salesman (user) belongs to the admin's company
    if (
      !pjpToDelete.user ||
      pjpToDelete.user.companyId !== currentUser.companyId
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot delete a PJP from another company' },
        { status: 403 },
      );
    }

    // 6. Delete the Permanent Journey Plan itself
    // We are no longer deleting associated tasks per the request.
    await prisma.permanentJourneyPlan.delete({
      where: { id: pjpId },
    });

    return NextResponse.json(
      { message: 'PJP deleted successfully' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error deleting PJP (DELETE):', error);
    return NextResponse.json(
      {
        error: 'Failed to delete permanent journey plan',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}