// src/app/api/dashboardPagesAPI/permanent-journey-plan/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife, revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma'; 
import { z } from 'zod'; 
import { permanentJourneyPlanSchema } from '@/lib/shared-zod-schema';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',];

const getISTDate = (date: Date | null) => {
  if (!date) return '';
  // Returns YYYY-MM-DD based on Asia/Kolkata time
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 2. The Cached Function: Isolated from runtime request data
async function getCachedPJPs(companyId: number, verificationStatus: string | null) {
  'use cache';
  cacheLife('days');
  cacheTag(`permanent-journey-plan-${companyId}`); // Unique tag per company

  const whereClause: any = {
    user: {
      companyId: companyId,
    },
  };

  // Apply the verification status filter if present
  if (verificationStatus) {
    whereClause.verificationStatus = verificationStatus;
  }

  const permanentJourneyPlans = await prisma.permanentJourneyPlan.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      createdBy: {
        select: { firstName: true, lastName: true, email: true, role: true },
      },
      dailyTasks: {
        select: { id: true, status: true, visitType: true, relatedDealerId: true, siteName: true },
      },
      dealer: { select: { name: true } },
      site: { select: { siteName: true } },
    },
    orderBy: {
      planDate: 'desc',
    },
  });

  return permanentJourneyPlans.map((plan: any) => {
    const salesmanName = `${plan.user.firstName || ''} ${plan.user.lastName || ''}`.trim() || plan.user.email;
    const createdByName = `${plan.createdBy.firstName || ''} ${plan.createdBy.lastName || ''}`.trim() || plan.createdBy.email;
    const taskIds = plan.dailyTasks.map((task: any) => task.id);
    const visitTargetName = plan.dealer?.name ?? plan.site?.siteName ?? null;

    return {
      id: plan.id,
      salesmanName: salesmanName,
      userId: plan.userId,
      createdByName: createdByName,
      createdByRole: plan.createdBy.role,
      areaToBeVisited: plan.areaToBeVisited,
      route: plan.route,
      planDate: getISTDate(plan.planDate),
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
}

export async function GET(request: NextRequest) {
  await connection();
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

    // 3. --- UPDATED ROLE-BASED AUTHORIZATION ---
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: `Forbidden: Only the following roles can access PJP data: ${allowedRoles.join(', ')}` }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus');

    // 4. Call the purely cached function
    const formattedPlans = await getCachedPJPs(currentUser.companyId, verificationStatus);

    // 5. Zod Validation
    const validatedData = z.array(permanentJourneyPlanSchema).parse(formattedPlans);

    return NextResponse.json(validatedData, { status: 200 });
  } catch (error) {
    console.error('Error fetching permanent journey plans:', error);
    return NextResponse.json({ error: 'Failed to fetch permanent journey plans', details: (error as Error).message }, { status: 500 });
  }
}


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

    // 6. CACHE INVALIDATION
    revalidateTag(`permanent-journey-plan-${currentUser.companyId}`, 'max');
    revalidateTag(`pjp-verification-${currentUser.companyId}`, 'max');

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