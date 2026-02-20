// src/app/api/dashboardPagesAPI/masonpc-side/mason-pc/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// --- IMPORT BONUS LOGIC ---
import { calculateJoiningBonusPoints } from '@/lib/pointsCalcLogic';

const kycUpdateSchema = z.object({
    // FIX 1: Make verificationStatus optional so we can save assignments without changing status
    verificationStatus: z.enum(['VERIFIED', 'REJECTED']).optional(),
    adminRemarks: z.string().nullable().optional(),
    userId: z.number().nullable().optional(),
    dealerId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    clearDevice: z.boolean().optional(),
});

// FE → Mason_PC_Side.kycStatus
const masonStatusMap: Record<'VERIFIED' | 'REJECTED', string> = {
    VERIFIED: 'verified',
    REJECTED: 'none',
};

// FE → KYCSubmission.status
const submissionStatusMap: Record<'VERIFIED' | 'REJECTED', string> = {
    VERIFIED: 'verified',
    REJECTED: 'rejected',
};

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive',
];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
    try {
        const resolvedParams = await Promise.resolve(params);
        const masonPcId = resolvedParams.id;

        if (!masonPcId) {
            return NextResponse.json({ error: 'Missing Mason/PC ID in request URL' }, { status: 400 });
        }

        // --- 1. Auth & Role Check ---
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Role (${currentUser?.role}) not authorized.` }, { status: 403 });
        }

        // --- 2. Validate Body ---
        const body = await request.json();
        const parsed = kycUpdateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
        }

        const { verificationStatus, adminRemarks, userId, dealerId, clearDevice } = parsed.data;

        // --- 3. Prepare Update Data Object ---
        // FIX 2: Create a dynamic object so we only update what was sent
        const updateData: any = {};

        if (userId !== undefined) updateData.userId = userId;
        if (dealerId !== undefined) updateData.dealerId = dealerId;
        if (clearDevice === true) { updateData.deviceId = null; }

        // FIX 3: Only map status if it was actually provided
        if (verificationStatus) {
            updateData.kycStatus = masonStatusMap[verificationStatus];
        }

        // --- 4. Fetch Existing Record ---
        const masonPcToUpdate = await prisma.mason_PC_Side.findUnique({
            where: { id: masonPcId },
            include: {
                user: true,
                // Fetch the specific pending submission we are acting on
                kycSubmissions: {
                    where: { status: 'pending' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!masonPcToUpdate) {
            return NextResponse.json({ error: 'Mason/PC record not found' }, { status: 404 });
        }

        // Allow updates if it's the same company, OR if the user is super-admin/president (optional check)
        if (currentUser.companyId && masonPcToUpdate.user?.companyId && masonPcToUpdate.user.companyId !== currentUser.companyId) {
            // Note: I added a safety check here because masonPcToUpdate.user might be null if unassigned
            return NextResponse.json({ error: 'Forbidden: External company record.' }, { status: 403 });
        }

        const latestSubmission = masonPcToUpdate.kycSubmissions?.[0];

        // --- 5. BONUS CALCULATION LOGIC ---
        const joiningBonus = calculateJoiningBonusPoints();

        let shouldApplyBonus = false;

        // Only calculate bonus if we are actually VERIFYING right now
        if (verificationStatus === 'VERIFIED') {
            const alreadyVerified = masonPcToUpdate.kycStatus === 'verified';
            shouldApplyBonus =
                !alreadyVerified &&
                joiningBonus > 0 &&
                !!latestSubmission;
        }

        // --- 6. TRANSACTION ---
        const updatedRecord = await prisma.$transaction(async (tx) => {

            // A. Update Mason Status AND Assignments
            // FIX 4: Use the `updateData` object we built earlier
            const updatedMason = await tx.mason_PC_Side.update({
                where: { id: masonPcId },
                data: {
                    ...updateData, // <--- This includes userId, dealerId, siteId, and kycStatus

                    // Atomic increment if bonus applies
                    pointsBalance: shouldApplyBonus
                        ? { increment: joiningBonus }
                        : undefined
                },
            });

            // B. Update KYC Submission Status (Only if verificationStatus is provided)
            // FIX 5: Guard this block
            if (verificationStatus && latestSubmission) {
                const submissionNextStatus = submissionStatusMap[verificationStatus];

                await tx.kYCSubmission.update({
                    where: { id: latestSubmission.id },
                    data: {
                        status: submissionNextStatus,
                        remark: adminRemarks ?? null,
                    },
                });
            }

            // C. Insert Ledger Entry (Only if Bonus Applies)
            if (shouldApplyBonus && latestSubmission) {
                await tx.pointsLedger.create({
                    data: {
                        masonId: masonPcId,
                        sourceType: 'joining_bonus',
                        sourceId: latestSubmission.id,
                        points: joiningBonus,
                        memo: `Joining Bonus: KYC Verified on ${new Date().toLocaleDateString()}`
                    }
                });
            }

            return updatedMason;
        });


        // Always clear the mason-pc cache for this company
        revalidateTag(`mason-pc-${currentUser.companyId}`, 'max');

        // If a bonus was applied, the ledger was updated, so clear the ledger cache too!
        if (shouldApplyBonus) {
            revalidateTag(`points-ledger-${currentUser.companyId}`, 'max');
        }

        // --- 7. Return Success ---
        return NextResponse.json({
            message: verificationStatus
                ? `Mason/PC KYC updated to ${verificationStatus}.`
                : `Assignments updated successfully.`,
            record: updatedRecord
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating KYC/Mason:', error);
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'Transaction failed: Database constraint violation.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to update record', details: (error as Error).message }, { status: 500 });
    }
}