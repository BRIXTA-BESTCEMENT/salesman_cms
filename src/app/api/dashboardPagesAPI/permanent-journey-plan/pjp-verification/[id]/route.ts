// src/app/api/dashboardPagesAPI/permanent-journey-plan/pjp-verification/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, permanentJourneyPlans, dealers, technicalSites } from '../../../../../../../drizzle'; 
import { eq } from 'drizzle-orm';
import { refreshCompanyCache } from '@/app/actions/cache';
import { selectPermanentJourneyPlanSchema, insertPermanentJourneyPlanSchema } from '../../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
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
    
    const results = await db
        .select({
            pjp: permanentJourneyPlans,
            user: { companyId: users.companyId }
        })
        .from(permanentJourneyPlans)
        .leftJoin(users, eq(permanentJourneyPlans.userId, users.id))
        .where(eq(permanentJourneyPlans.id, pjpId))
        .limit(1);

    const pjpToUpdate = results[0];

    if (!pjpToUpdate) {
        return { error: 'PJP not found', status: 404 };
    }

    if (!pjpToUpdate.user || pjpToUpdate.user.companyId !== currentUserCompanyId) {
        return { error: 'Forbidden: Cannot verify a PJP from another company', status: 403 };
    }

    return { pjpToUpdate: pjpToUpdate.pjp };
}

/**
 * PUT: Update the verificationStatus of a PJP (VERIFIED or REJECTED).
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id: pjpId } = await params;

        if (!pjpId) {
            return NextResponse.json({ error: 'Missing PJP ID in request URL' }, { status: 400 });
        }

        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const verificationResult = await verifyPJP(pjpId, currentUser.companyId);
        if (verificationResult.error) {
            return NextResponse.json({ error: verificationResult.error }, { status: verificationResult.status });
        }

        const body = await request.json();
        // Use insert schema to pick required validation fields
        const pjpVerificationUpdateSchema = insertPermanentJourneyPlanSchema.pick({ 
            verificationStatus: true,
            additionalVisitRemarks: true 
        });
        const validatedBody = pjpVerificationUpdateSchema.safeParse(body);

        if (!validatedBody.success) {
            return NextResponse.json({ error: 'Invalid data format.', details: validatedBody.error.issues }, { status: 400 });
        }

        const { verificationStatus, additionalVisitRemarks } = validatedBody.data;

        const updatedPJPResult = await db
            .update(permanentJourneyPlans)
            .set({
                verificationStatus: verificationStatus as string,
                additionalVisitRemarks,
                status: verificationStatus as string,
            })
            .where(eq(permanentJourneyPlans.id, pjpId))
            .returning();

        await refreshCompanyCache('pjp-verification');

        return NextResponse.json({
            message: `PJP status updated to ${verificationStatus}`,
            pjp: updatedPJPResult[0]
        }, { status: 200 });

    } catch (error) {
        console.error('Error (PUT):', error);
        return NextResponse.json({ error: 'Failed to update PJP status', details: (error as Error).message }, { status: 500 });
    }
}

/**
 * PATCH: Modify PJP data fields and set status to 'VERIFIED'.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id: pjpId } = await params;

        if (!pjpId) {
            return NextResponse.json({ error: 'Missing PJP ID' }, { status: 400 });
        }

        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const verify = await verifyPJP(pjpId, currentUser.companyId);
        if (verify.error) return NextResponse.json({ error: verify.error }, { status: verify.status });

        // Use baked schema for full modification validation, marking fields optional for PATCH
        const pjpModificationSchema = insertPermanentJourneyPlanSchema.partial().loose();
        const v = pjpModificationSchema.safeParse(await request.json());
        
        if (!v.success) {
            return NextResponse.json({ error: 'Invalid PJP modification data.', details: v.error.issues }, { status: 400 });
        }

        // Logic for checking dealer/site existence
        if (v.data.dealerId) {
            const dealerExists = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.id, v.data.dealerId)).limit(1);
            if (!dealerExists[0]) return NextResponse.json({ error: 'Invalid dealerId' }, { status: 400 });
        }
        if (v.data.siteId) {
            const siteExists = await db.select({ id: technicalSites.id }).from(technicalSites).where(eq(technicalSites.id, v.data.siteId)).limit(1);
            if (!siteExists[0]) return NextResponse.json({ error: 'Invalid siteId' }, { status: 400 });
        }

        const updatedPJPResult = await db
            .update(permanentJourneyPlans)
            .set({
                ...v.data,
                planDate: v.data.planDate ? new Date(v.data.planDate).toISOString() : undefined,
                verificationStatus: 'VERIFIED',
                status: 'VERIFIED',
            })
            .where(eq(permanentJourneyPlans.id, pjpId))
            .returning();

        // Fetch relation names for the response
        const finalPjp = await db
            .select({
                pjp: permanentJourneyPlans,
                dealerName: dealers.name,
                siteName: technicalSites.siteName
            })
            .from(permanentJourneyPlans)
            .leftJoin(dealers, eq(permanentJourneyPlans.dealerId, dealers.id))
            .leftJoin(technicalSites, eq(permanentJourneyPlans.siteId, technicalSites.id))
            .where(eq(permanentJourneyPlans.id, pjpId))
            .limit(1);

        await refreshCompanyCache('pjp-verification');
        await refreshCompanyCache('permanent-journey-plan');

        return NextResponse.json({
            message: `PJP modified and VERIFIED successfully`,
            pjp: {
                ...finalPjp[0].pjp,
                dealerName: finalPjp[0].dealerName ?? null,
                siteName: finalPjp[0].siteName ?? null,
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error (PATCH):', error);
        return NextResponse.json({ error: 'Failed to modify PJP', details: (error as Error).message }, { status: 500 });
    }
}