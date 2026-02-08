// src/app/api/dashboardPagesAPI/add-dealers/dealer-verify/bulk-verify/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Roles allowed to perform verification
const allowedRoles = [
    'Admin',
    'president',
    'senior-general-manager',
    'general-manager',
    'regional-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager',
    'senior-executive',
    'executive'
];

const bulkVerifySchema = z.object({
    ids: z.array(z.string()).min(1, "At least one dealer ID is required"),
});

export async function PATCH(request: NextRequest) {
    try {
        // 1. Authentication
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch User & Authorization
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 3. Parse Body
        const body = await request.json();
        const validation = bulkVerifySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid data', details: validation.error }, { status: 400 });
        }

        const { ids } = validation.data;

        // 4. Security Step: Filter IDs to ensure they belong to the user's company
        // We cannot blindly update ID matches because a user might send an ID from another company.
        const validDealers = await prisma.dealer.findMany({
            where: {
                id: { in: ids },
                user: {
                    companyId: currentUser.companyId
                },
                verificationStatus: 'PENDING' // Only verify currently pending ones
            },
            select: { id: true }
        });

        const validIds = validDealers.map(d => d.id);

        if (validIds.length === 0) {
            return NextResponse.json({ message: 'No valid pending dealers found to verify.' }, { status: 200 });
        }

        // 5. Perform Bulk Update
        const result = await prisma.dealer.updateMany({
            where: {
                id: { in: validIds }
            },
            data: {
                verificationStatus: 'VERIFIED'
            }
        });

        return NextResponse.json({ 
            message: 'Bulk verification successful', 
            count: result.count 
        }, { status: 200 });

    } catch (error: any) {
        console.error('Bulk verify error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}