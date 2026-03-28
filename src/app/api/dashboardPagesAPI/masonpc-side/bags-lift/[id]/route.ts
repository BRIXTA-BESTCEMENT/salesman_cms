// src/app/api/dashboardPagesAPI/masonpc-side/bags-lift/[id]/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, bagLifts, masonPcSide, pointsLedger } from '../../../../../../../drizzle';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { refreshCompanyCache } from '@/app/actions/cache';
import {
  calculateExtraBonusPoints,
  checkReferralBonusTrigger
} from '@/lib/pointsCalcLogic';
import { verifySession } from '@/lib/auth';

const bagLiftUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  memo: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bagLiftId } = await params;

    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
    if (!hasRequiredPerms) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bagLiftUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { status: newStatus, memo } = parsed.data;

    // Fetch Record with Mason & Company Context
    const existing = await db
      .select({
        bagLift: bagLifts,
        mason: masonPcSide,
        masonCompanyId: users.companyId
      })
      .from(bagLifts)
      .innerJoin(masonPcSide, eq(bagLifts.masonId, masonPcSide.id))
      .leftJoin(users, eq(masonPcSide.userId, users.id))
      .where(eq(bagLifts.id, bagLiftId))
      .limit(1);

    const record = existing[0];
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (record.masonCompanyId !== session.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const currentStatus = record.bagLift.status;
    const points = record.bagLift.pointsCredited;
    const masonId = record.bagLift.masonId;

    if (newStatus === currentStatus) return NextResponse.json({ error: 'Status unchanged' }, { status: 400 });
    if (newStatus === 'approved' && currentStatus === 'rejected') return NextResponse.json({ error: 'Cannot approve rejected lift' }, { status: 400 });

    const transactionResult = await db.transaction(async (tx) => {

      // SCENARIO A: APPROVING
      if (newStatus === 'approved' && currentStatus === 'pending') {
        const [updatedBagLift] = await tx.update(bagLifts)
          .set({
            status: 'approved',
            approvedBy: session.userId,
            approvedAt: new Date().toISOString()
          })
          .where(eq(bagLifts.id, bagLiftId))
          .returning();

        await tx.insert(pointsLedger).values({
          id: randomUUID(),
          masonId: masonId,
          sourceType: 'bag_lift',
          sourceId: updatedBagLift.id,
          points: points,
          memo: memo || `Credit for ${updatedBagLift.bagCount} bags.`,
          createdAt: new Date().toISOString()
        });

        await tx.update(masonPcSide)
          .set({
            pointsBalance: sql`${masonPcSide.pointsBalance} + ${points}`,
            bagsLifted: sql`${masonPcSide.bagsLifted} + ${updatedBagLift.bagCount}`
          })
          .where(eq(masonPcSide.id, masonId));

        // Bonus Logic
        const extraBonus = calculateExtraBonusPoints(
          record.mason.bagsLifted || 0,
          updatedBagLift.bagCount,
          record.bagLift.purchaseDate ? new Date(record.bagLift.purchaseDate) : new Date()
        );

        if (extraBonus > 0) {
          await tx.insert(pointsLedger).values({
            id: randomUUID(),
            masonId: masonId,
            points: extraBonus,
            sourceType: 'adjustment',
            memo: `Extra Bonus for crossing bag slab.`,
            createdAt: new Date().toISOString()
          });
          await tx.update(masonPcSide)
            .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${extraBonus}` })
            .where(eq(masonPcSide.id, masonId));
        }

        // Referral Logic
        if (record.mason.referredByUser) {
          const referralPoints = checkReferralBonusTrigger(record.mason.bagsLifted || 0, updatedBagLift.bagCount);
          if (referralPoints > 0) {
            await tx.insert(pointsLedger).values({
              id: randomUUID(),
              masonId: record.mason.referredByUser,
              points: referralPoints,
              sourceType: 'referral_bonus',
              memo: `Referral bonus for Mason ${masonId} hitting milestone.`,
              createdAt: new Date().toISOString()
            });
            await tx.update(masonPcSide)
              .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${referralPoints}` })
              .where(eq(masonPcSide.id, record.mason.referredByUser));
          }
        }
        return updatedBagLift;
      }

      // SCENARIO B: REJECTING APPROVED
      else if (newStatus === 'rejected' && currentStatus === 'approved') {
        const [updatedBagLift] = await tx.update(bagLifts)
          .set({ status: 'rejected', approvedBy: session.userId })
          .where(eq(bagLifts.id, bagLiftId))
          .returning();

        await tx.insert(pointsLedger).values({
          id: randomUUID(),
          masonId: masonId,
          sourceType: 'adjustment',
          points: -points,
          memo: memo || `Debit: Bag Lift rejected by Admin.`,
          createdAt: new Date().toISOString()
        });

        await tx.update(masonPcSide)
          .set({
            pointsBalance: sql`${masonPcSide.pointsBalance} - ${points}`,
            bagsLifted: sql`${masonPcSide.bagsLifted} - ${record.bagLift.bagCount}`
          })
          .where(eq(masonPcSide.id, masonId));

        return updatedBagLift;
      }

      // SCENARIO C: PENDING -> REJECTED
      const [simpleUpdate] = await tx.update(bagLifts)
        .set({ status: newStatus, approvedBy: session.userId })
        .where(eq(bagLifts.id, bagLiftId))
        .returning();
      return simpleUpdate;
    });

    await refreshCompanyCache('bags-lift');
    await refreshCompanyCache('mason-pc');
    await refreshCompanyCache('points-ledger');

    return NextResponse.json({ success: true, data: transactionResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}