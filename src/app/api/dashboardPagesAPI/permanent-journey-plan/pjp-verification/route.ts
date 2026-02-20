// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { permanentJourneyPlanVerificationSchema } from '@/lib/shared-zod-schema'; 

const allowedRoles = [
    'Admin',
    'president',
    'senior-general-manager',
    'general-manager',
    'regional-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager',
];

const getISTDate = (date: Date | null) => {
  if (!date) return '';
  // Returns YYYY-MM-DD based on Asia/Kolkata time
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// 2. The Cached Function
async function getCachedPendingPJPs(companyId: number) {
    'use cache';
    cacheLife('hours');
    cacheTag(`pjp-verification-${companyId}`); // Unique tag per company

    const pendingPJPs = await prisma.permanentJourneyPlan.findMany({
        where: {
            user: {
                companyId: companyId,
            },
            OR: [
                { status: 'PENDING' },
                { verificationStatus: 'PENDING' }
            ]
        },
        include: {
            user: {
                select: {
                    id: true, firstName: true, lastName: true,
                    email: true, region: true, area: true,
                },
            },
            createdBy: {
                select: {
                    firstName: true, lastName: true, email: true, role: true,
                },
            },
            dealer: { select: { name: true } },
            site: { select: { siteName: true } },
        },
        orderBy: {
            planDate: 'asc',
        },
    });

    return pendingPJPs.map((plan: any) => {
        const salesmanName = `${plan.user.firstName || ''} ${plan.user.lastName || ''}`.trim() || plan.user.email;
        const createdByName = `${plan.createdBy.firstName || ''} ${plan.createdBy.lastName || ''}`.trim() || plan.createdBy.email;
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
            noOfConvertedBags: plan.noOfConvertedBags ?? 0,
            noOfMasonPcSchemes: plan.noOfMasonPcSchemes ?? 0,
            dealerId: plan.dealerId,
            siteId: plan.siteId,
            visitDealerName: visitTargetName,
            verificationStatus: plan.verificationStatus ? plan.verificationStatus.toUpperCase() : 'PENDING',
            additionalVisitRemarks: plan.additionalVisitRemarks,
            salesmanRegion: plan.user.region,
            salesmanArea: plan.user.area,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
        };
    });
}

export async function GET(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized: No claims found' }, { status: 401 });
        }

        // 2. Fetch Current User for robust role and companyId check
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        // 3. Authorization Check (Role and Existence)
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({
                error: `Forbidden: Your role (${currentUser?.role || 'None'}) is not authorized for PJP verification.`
            }, { status: 403 });
        }

        // 4. Call the purely cached function
        const formattedPlans = await getCachedPendingPJPs(currentUser.companyId);

        // 5. Validate and return data
        const validatedPlans = z.array(permanentJourneyPlanVerificationSchema).safeParse(formattedPlans);

        if (!validatedPlans.success) {
            console.error("GET Response Validation Error:", validatedPlans.error);
            return NextResponse.json({ error: 'Data integrity error on server', details: validatedPlans.error }, { status: 500 });
        }

        return NextResponse.json({ plans: validatedPlans.data }, { status: 200 });

    } catch (error) {
        console.error('Error fetching pending PJPs (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch pending PJPs', details: (error as Error).message }, { status: 500 });
    }
}