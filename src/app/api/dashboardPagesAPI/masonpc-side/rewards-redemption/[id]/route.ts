// src/app/api/dashboardPagesAPI/masonpc-side/rewards-redemption/[id]/route.ts
import 'server-only';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { randomUUID } from 'crypto';

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
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const redemptionId = resolvedParams.id;

    // --- 1. Auth & Role Check ---
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true },
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // --- 2. Validate Input ---
    const body = await request.json();
    const parsed = redemptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }
    // NORMALIZE: Ensure we work with lowercase for logic but store uppercase
    const newStatus = parsed.data.status.toLowerCase();
    const fulfillmentNotes = parsed.data.fulfillmentNotes || "";

    // --- 3. Fetch Existing Record ---
    // We need the mason's ID, the cost, and the reward ID for stock checks
    const existingRecord = await prisma.rewardRedemption.findUnique({
      where: { id: redemptionId },
      include: {
        mason: { select: { id: true, user: { select: { companyId: true } } } },
        reward: { select: { id: true, stock: true } } // Fetch current stock
      }
    });

   if (!existingRecord) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    const currentStatus = existingRecord.status.toLowerCase(); 
    const { masonId, pointsDebited, quantity, rewardId } = existingRecord;

    // Logic Gates: Match the App's restrictions
    if (currentStatus === 'delivered') {
        return NextResponse.json({ error: 'Cannot update a delivered order.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {

        // SCENARIO A: APPROVING (Placed -> Approved)
        if (currentStatus === 'placed' && newStatus === 'approved') {
            const rewardItem = await tx.rewards.findUnique({ where: { id: rewardId } });
            
            if (!rewardItem || rewardItem.stock < quantity) {
                throw new Error(`Insufficient stock. Available: ${rewardItem?.stock ?? 0}`);
            }

            // Deduct Stock
            await tx.rewards.update({
                where: { id: rewardId },
                data: { stock: { decrement: quantity } }
            });
        }

        // SCENARIO B & C: REJECTING (Placed or Approved -> Rejected)
        else if (newStatus === 'rejected') {
            
            // 1. Refund Points Ledger
            await tx.pointsLedger.create({
                data: {
                    id: randomUUID(),
                    masonId: masonId,
                    sourceType: 'adjustment',
                    // FIX: Use randomUUID here to avoid P2002 unique constraint error
                    sourceId: randomUUID(), 
                    points: pointsDebited,
                    memo: `Refund for Order ${redemptionId.substring(0,8)}. Reason: ${fulfillmentNotes}`
                }
            });

            // 2. Add back to Mason Balance
            await tx.mason_PC_Side.update({
                where: { id: masonId },
                data: { pointsBalance: { increment: pointsDebited } }
            });

            // 3. Return Stock ONLY if it was previously deducted (Approved/Shipped)
            if (currentStatus === 'approved' || currentStatus === 'shipped') {
                await tx.rewards.update({
                    where: { id: rewardId },
                    data: { stock: { increment: quantity } }
                });
            }
        }

        // SCENARIO D: FINAL STATUS UPDATE
        return await tx.rewardRedemption.update({
            where: { id: redemptionId },
            data: { 
                status: newStatus.toUpperCase(), 
                fulfillmentNotes: fulfillmentNotes,
                updatedAt: new Date() 
            }
        });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}