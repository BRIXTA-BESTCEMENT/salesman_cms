// src/app/api/dashboardPagesAPI/add-dealers/dealer-verify/bulk-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../../drizzle'; 
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { refreshCompanyCache } from '@/app/actions/cache';

// Roles allowed to perform verification
const allowedRoles = [
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
        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

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
        const validDealers = await db
            .select({ id: dealers.id })
            .from(dealers)
            .leftJoin(users, eq(dealers.userId, users.id))
            .where(
                and(
                    inArray(dealers.id, ids),
                    eq(users.companyId, currentUser.companyId),
                    eq(dealers.verificationStatus, 'PENDING') // Only verify currently pending ones
                )
            );

        const validIds = validDealers.map(d => d.id);

        if (validIds.length === 0) {
            return NextResponse.json({ message: 'No valid pending dealers found to verify.' }, { status: 200 });
        }

        // 5. Perform Bulk Update
        await db
            .update(dealers)
            .set({ verificationStatus: 'VERIFIED' })
            .where(inArray(dealers.id, validIds));

        // Revalidate cache using the centralized Server Action
        await refreshCompanyCache('dealers');
        await refreshCompanyCache('verified-dealers-list');

        return NextResponse.json({ message: 'Bulk verification successful', count: validIds.length }, { status: 200 });

    } catch (error: any) {
        console.error('Bulk verify error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}