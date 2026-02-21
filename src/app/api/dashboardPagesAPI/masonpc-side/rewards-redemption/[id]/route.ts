// src/app/api/dashboardPagesAPI/masonpc-side/rewards-redemption/[id]/route.ts
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, rewardRedemptions, rewards, pointsLedger, masonPcSide } from '../../../../../../../drizzle'; 
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { refreshCompanyCache } from '@/app/actions/cache';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

const redemptionUpdateSchema = z.object({
  status: z.enum(['approved', 'shipped', 'delivered', 'rejected']),
  fulfillmentNotes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: redemptionId } = await params;
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ id: users.id, role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = redemptionUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });

    const newStatus = parsed.data.status.toLowerCase();
    const fulfillmentNotes = parsed.data.fulfillmentNotes || "";

    // Fetch Existing Record with multi-tenancy check join
    const existingResult = await db
      .select({
        redemption: rewardRedemptions,
        rewardStock: rewards.stock,
        rewardItemName: rewards.itemName,
        masonCompanyId: users.companyId
      })
      .from(rewardRedemptions)
      .leftJoin(rewards, eq(rewardRedemptions.rewardId, rewards.id))
      .leftJoin(masonPcSide, eq(rewardRedemptions.masonId, masonPcSide.id))
      .leftJoin(users, eq(masonPcSide.userId, users.id))
      .where(eq(rewardRedemptions.id, redemptionId))
      .limit(1);

    const record = existingResult[0];
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    if (record.masonCompanyId !== currentUser.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const currentStatus = record.redemption.status.toLowerCase();
    if (currentStatus === 'delivered') return NextResponse.json({ error: 'Cannot update a delivered order.' }, { status: 400 });

    const finalResult = await db.transaction(async (tx) => {
      // SCENARIO A: APPROVING (Placed -> Approved)
      if (currentStatus === 'placed' && newStatus === 'approved') {
        if ((record.rewardStock ?? 0) < record.redemption.quantity) {
          throw new Error(`Insufficient stock for ${record.rewardItemName}.`);
        }
        await tx.update(rewards)
          .set({ stock: sql`${rewards.stock} - ${record.redemption.quantity}` })
          .where(eq(rewards.id, record.redemption.rewardId));
      }
      // SCENARIO B & C: REJECTING (Placed or Approved -> Rejected)
      else if (newStatus === 'rejected') {
        // Refund Points Ledger
        await tx.insert(pointsLedger).values({
          id: randomUUID(),
          masonId: record.redemption.masonId,
          sourceType: 'adjustment',
          sourceId: randomUUID(),
          points: record.redemption.pointsDebited,
          memo: `Refund for Order ${redemptionId.substring(0, 8)}. Reason: ${fulfillmentNotes}`,
          createdAt: new Date().toISOString()
        });

        // Add back to Mason Balance
        await tx.update(masonPcSide)
          .set({ pointsBalance: sql`${masonPcSide.pointsBalance} + ${record.redemption.pointsDebited}` })
          .where(eq(masonPcSide.id, record.redemption.masonId));

        // Return Stock if previously deducted
        if (currentStatus === 'approved' || currentStatus === 'shipped') {
          await tx.update(rewards)
            .set({ stock: sql`${rewards.stock} + ${record.redemption.quantity}` })
            .where(eq(rewards.id, record.redemption.rewardId));
        }
      }

      const [updated] = await tx.update(rewardRedemptions)
        .set({
          status: newStatus.toUpperCase(),
          fulfillmentNotes: fulfillmentNotes,
          updatedAt: new Date().toISOString()
        })
        .where(eq(rewardRedemptions.id, redemptionId))
        .returning();
      
      return updated;
    });

    await refreshCompanyCache('rewards-redemption');
    if (newStatus === 'approved' || newStatus === 'rejected') await refreshCompanyCache('rewards');
    if (newStatus === 'rejected') {
        await refreshCompanyCache('points-ledger');
        await refreshCompanyCache('mason-pc');
    }

    return NextResponse.json({ success: true, data: finalResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}