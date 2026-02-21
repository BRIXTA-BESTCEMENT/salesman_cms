// src/app/api/dashboardPagesAPI/masonpc-side/mason-pc/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, masonPcSide, kycSubmissions, pointsLedger } from '../../../../../../../drizzle'; 
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { calculateJoiningBonusPoints } from '@/lib/pointsCalcLogic';
import { refreshCompanyCache } from '@/app/actions/cache';

const kycUpdateSchema = z.object({
    verificationStatus: z.enum(['VERIFIED', 'REJECTED']).optional(),
    adminRemarks: z.string().nullable().optional(),
    userId: z.number().nullable().optional(),
    dealerId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    clearDevice: z.boolean().optional(),
});

const masonStatusMap: Record<'VERIFIED' | 'REJECTED', string> = {
    VERIFIED: 'verified',
    REJECTED: 'none',
};

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: masonPcId } = await params;
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserResult = await db.select({ id: users.id, role: users.role, companyId: users.companyId }).from(users).where(eq(users.workosUserId, claims.sub)).limit(1);
        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const parsed = kycUpdateSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

        const { verificationStatus, adminRemarks, userId, dealerId, siteId, clearDevice } = parsed.data;

        // Fetch Existing Record
        const existing = await db.select({
            mason: masonPcSide,
            companyId: users.companyId
        }).from(masonPcSide)
          .leftJoin(users, eq(masonPcSide.userId, users.id))
          .where(eq(masonPcSide.id, masonPcId)).limit(1);

        const record = existing[0];
        if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        
        if (record.companyId && record.companyId !== currentUser.companyId) {
            return NextResponse.json({ error: 'Forbidden: External company record.' }, { status: 403 });
        }

        const latestSub = await db.select().from(kycSubmissions).where(and(eq(kycSubmissions.masonId, masonPcId), eq(kycSubmissions.status, 'pending'))).orderBy(desc(kycSubmissions.createdAt)).limit(1);
        const latestSubmission = latestSub[0];

        const joiningBonus = calculateJoiningBonusPoints();
        const shouldApplyBonus = verificationStatus === 'VERIFIED' && record.mason.kycStatus !== 'verified' && joiningBonus > 0 && !!latestSubmission;

        const updatedRecord = await db.transaction(async (tx) => {
            const updateFields: any = { updatedAt: new Date().toISOString() };
            if (userId !== undefined) updateFields.userId = userId;
            if (dealerId !== undefined) updateFields.dealerId = dealerId;
            if (siteId !== undefined) updateFields.siteId = siteId;
            if (clearDevice) updateFields.deviceId = null;
            if (verificationStatus) updateFields.kycStatus = masonStatusMap[verificationStatus];
            if (shouldApplyBonus) updateFields.pointsBalance = sql`${masonPcSide.pointsBalance} + ${joiningBonus}`;

            const [updated] = await tx.update(masonPcSide).set(updateFields).where(eq(masonPcSide.id, masonPcId)).returning();

            if (verificationStatus && latestSubmission) {
                await tx.update(kycSubmissions).set({
                    status: submissionStatusMap[verificationStatus],
                    remark: adminRemarks ?? null,
                }).where(eq(kycSubmissions.id, latestSubmission.id));
            }

            if (shouldApplyBonus && latestSubmission) {
                await tx.insert(pointsLedger).values({
                    id: crypto.randomUUID(),
                    masonId: masonPcId,
                    sourceType: 'joining_bonus',
                    sourceId: latestSubmission.id,
                    points: joiningBonus,
                    memo: `Joining Bonus: KYC Verified on ${new Date().toLocaleDateString()}`
                });
            }
            return updated;
        });

        await refreshCompanyCache('mason-pc');
        if (shouldApplyBonus) await refreshCompanyCache('points-ledger');

        return NextResponse.json({ message: 'Success', record: updatedRecord });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}