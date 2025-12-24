// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/[id]/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
// zod schema imports
import { pjpModificationSchema, pjpVerificationUpdateSchema } from '@/lib/shared-zod-schema';


// Roles allowed for PUT/PATCH operations (same as GET)
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

/**
 * Helper function to verify PJP ownership and existence
 */
async function verifyPJP(pjpId: string, currentUserCompanyId: number) {
    if (!pjpId) {
        throw new Error("PJP ID is required for verification/modification.");
    }
    const pjpToUpdate = await prisma.permanentJourneyPlan.findUnique({
        where: { id: pjpId },
        include: { user: true }
    });

    if (!pjpToUpdate) {
        return { error: 'PJP not found', status: 404 };
    }

    // Ensure the PJP belongs to the current user's company
    if (!pjpToUpdate.user || pjpToUpdate.user.companyId !== currentUserCompanyId) {
        return { error: 'Forbidden: Cannot verify a PJP from another company', status: 403 };
    }

    return { pjpToUpdate };
}


/**
 * PUT: Update the verificationStatus of a PJP (VERIFIED or REJECTED).
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
    try {
        const resolvedParams = await Promise.resolve(params);
        const pjpId = resolvedParams.id;

        if (!pjpId) {
            return NextResponse.json({ error: 'Missing PJP ID in request URL' }, { status: 400 });
        }

        const claims = await getTokenClaims();

        // 1. Authentication & Authorization Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized: No claims found' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Your role (${currentUser?.role || 'None'}) is not authorized for PJP verification.` }, { status: 403 });
        }

        // 2. Validate PJP existence and ownership
        const verificationResult = await verifyPJP(pjpId, currentUser.companyId);
        if (verificationResult.error) {
            return NextResponse.json({ error: verificationResult.error }, { status: verificationResult.status });
        }

        // 3. Validate request body
        const body = await request.json();
        const validatedBody = pjpVerificationUpdateSchema.safeParse(body);

        if (!validatedBody.success) {
            console.error("PUT Request Body Validation Error:", validatedBody.error);
            return NextResponse.json({ error: 'Invalid verification status format or value.', details: validatedBody.error.issues }, { status: 400 });
        }

        const { verificationStatus, additionalVisitRemarks } = validatedBody.data;

        // 4. Update the PJP status
        const updatedPJP = await prisma.permanentJourneyPlan.update({
            where: { id: pjpId },
            data: {
                verificationStatus: verificationStatus,
                additionalVisitRemarks: additionalVisitRemarks,
                // Update the old 'status' field for compatibility/visibility
                status: verificationStatus,
            },
        });

        return NextResponse.json({
            message: `PJP status updated to ${verificationStatus}`,
            pjp: updatedPJP
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating PJP status (PUT):', error);
        return NextResponse.json({ error: 'Failed to update PJP status', details: (error as Error).message }, { status: 500 });
    }
}

/**
 * PATCH: Modify PJP data fields and set status to 'VERIFIED' (Admin modification and approval).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
    try {
        // FIX: AWAIT the params object before destructuring/accessing id, as requested by the error message.
        const resolvedParams = await Promise.resolve(params);
        const pjpId = resolvedParams.id;

        if (!pjpId) {
            return NextResponse.json({ error: 'Missing PJP ID in request URL' }, { status: 400 });
        }

        const claims = await getTokenClaims();

        // 1. Authentication & Authorization Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized: No claims found' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Your role (${currentUser?.role || 'None'}) is not authorized to modify/verify PJPs.` }, { status: 403 });
        }

        const verify = await verifyPJP(pjpId, currentUser.companyId);
        if (verify.error) return NextResponse.json({ error: verify.error }, { status: verify.status });

        // Validate payload against updated DTO (dealerId instead of visitDealerName)
        const v = pjpModificationSchema.safeParse(await request.json());
        if (!v.success) {
            console.error('PATCH Request Body Validation Error:', v.error);
            return NextResponse.json({ error: 'Invalid PJP modification data.', details: v.error.issues }, { status: 400 });
        }

        const {
            planDate, areaToBeVisited, route, description,
            plannedNewSiteVisits, plannedFollowUpSiteVisits,
            plannedNewDealerVisits, plannedInfluencerVisits,
            influencerName, influencerPhone, activityType,
            noOfConvertedBags, noOfMasonPcSchemes,
            dealerId, siteId, additionalVisitRemarks, diversionReason
        } = v.data;

        // Optional guard: if dealerId provided, ensure it exists
        if (dealerId) {
            const dealerExists = await prisma.dealer.findUnique(
                { where: { id: dealerId }, select: { id: true } }
            );
            if (!dealerExists) {
                return NextResponse.json({ error: 'Invalid dealerId: dealer not found.' }, { status: 400 });
            }
        }

        // Optional guard: if siteId provided, ensure it exists
        if (siteId) {
            const siteExists = await prisma.technicalSite.findUnique(
                { where: { id: siteId }, select: { id: true } }
            );
            if (!siteExists) {
                return NextResponse.json({ error: 'Invalid siteId: site not found.' }, { status: 400 });
            }
        }

        const updatedPJP = await prisma.permanentJourneyPlan.update({
            where: { id: pjpId },
            data: {
                planDate: planDate ? new Date(planDate) : undefined,
                areaToBeVisited,
                route,
                description,
                plannedNewSiteVisits,
                plannedFollowUpSiteVisits,
                plannedNewDealerVisits,
                plannedInfluencerVisits,
                influencerName,
                influencerPhone,
                activityType,
                noOfConvertedBags,
                noOfMasonPcSchemes,
                dealerId: dealerId ?? null,
                siteId: siteId ?? null,
                diversionReason,
                verificationStatus: 'VERIFIED',
                status: 'VERIFIED',
                additionalVisitRemarks,
            },
            include: {
                dealer: { select: { name: true } },
                site: { select: { siteName: true } }
            }
        });

        return NextResponse.json({
            message: `PJP modified and VERIFIED successfully`,
            pjp: {
                ...updatedPJP,
                dealerName: updatedPJP.dealer?.name ?? null,
                siteName: updatedPJP.site?.siteName ?? null,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error modifying and verifying PJP (PATCH):', error);
        return NextResponse.json({ error: 'Failed to modify and verify PJP', details: (error as Error).message }, { status: 500 });
    }
}