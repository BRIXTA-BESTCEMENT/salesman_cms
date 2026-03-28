// src/app/api/dashboardPagesAPI/add-dealers/dealer-verify/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../../drizzle';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { selectDealerSchema, insertDealerSchema } from '../../../../../../drizzle/zodSchemas';
import { refreshCompanyCache } from '@/app/actions/cache';
import { verifySession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    await connection();
    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!session.permissions.includes('READ')) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        // 4. Fetch pending dealers for the current user's company
        const pendingDealers = await db
            .select({
                id: dealers.id,
                name: dealers.name,
                phoneNo: dealers.phoneNo,
                area: dealers.area,
                region: dealers.region,
                type: dealers.type,
                verificationStatus: dealers.verificationStatus,
                nameOfFirm: dealers.nameOfFirm,
                underSalesPromoterName: dealers.underSalesPromoterName,
                // Statutory IDs
                gstinNo: dealers.gstinNo,
                panNo: dealers.panNo,
                aadharNo: dealers.aadharNo,
                tradeLicNo: dealers.tradeLicNo,
                // Image URLs
                tradeLicencePicUrl: dealers.tradeLicencePicUrl,
                shopPicUrl: dealers.shopPicUrl,
                dealerPicUrl: dealers.dealerPicUrl,
                blankChequePicUrl: dealers.blankChequePicUrl,
                partnershipDeedPicUrl: dealers.partnershipDeedPicUrl,
                remarks: dealers.remarks,
            })
            .from(dealers)
            .leftJoin(users, eq(dealers.userId, users.id))
            .where(
                and(
                    eq(users.companyId, session.companyId),
                    eq(dealers.verificationStatus, 'PENDING')
                )
            )
            .orderBy(asc(dealers.createdAt));

        // 5. Validate and return data
        const frontendDealerSchema = selectDealerSchema.partial().loose();
        const validatedDealers = z.array(frontendDealerSchema).safeParse(pendingDealers);

        if (!validatedDealers.success) {
            console.error("GET Response Validation Error:", validatedDealers.error);
            return NextResponse.json({ error: 'Data integrity error on server', details: validatedDealers.error }, { status: 500 });
        }

        return NextResponse.json({ dealers: validatedDealers.data }, { status: 200 });

    } catch (error) {
        console.error('Error fetching pending dealers (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch pending dealers', details: (error as Error).message }, { status: 500 });
    }
}

/**
 * PUT: Update the verificationStatus of a dealer.
 */
export async function PUT(request: NextRequest) {
    try {
        // 1. Authentication Check
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
        if (!hasRequiredPerms) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        // Get dealerId from query parameters
        const { searchParams } = new URL(request.url);
        const dealerId = searchParams.get('id');

        if (!dealerId || !z.string().safeParse(dealerId).success) {
            return NextResponse.json({ error: 'Missing or invalid dealer ID in query' }, { status: 400 });
        }

        // 4. Validate request body
        const body = await request.json();
        const verificationUpdateSchema = insertDealerSchema.pick({ verificationStatus: true });
        const validatedBody = verificationUpdateSchema.safeParse(body);

        if (!validatedBody.success) {
            console.error("PUT Request Body Validation Error:", validatedBody.error);
            return NextResponse.json({ error: 'Invalid verification status format or value.', details: validatedBody.error.issues }, { status: 400 });
        }

        const { verificationStatus } = validatedBody.data;

        // 5. Verify dealer existence and company ownership
        const dealerToUpdateResult = await db
            .select({ id: dealers.id, userCompanyId: users.companyId })
            .from(dealers)
            .leftJoin(users, eq(dealers.userId, users.id))
            .where(eq(dealers.id, dealerId))
            .limit(1);

        const dealerToUpdate = dealerToUpdateResult[0];

        if (!dealerToUpdate) {
            return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
        }

        if (dealerToUpdate.userCompanyId !== session.companyId) {
            return NextResponse.json({ error: 'Forbidden: Cannot update a dealer from another company' }, { status: 403 });
        }

        // 6. Update the verification status
        await db
            .update(dealers)
            .set({ verificationStatus: verificationStatus })
            .where(eq(dealers.id, dealerId));

        await refreshCompanyCache('dealers');
        await refreshCompanyCache('verified-dealers-list');

        return NextResponse.json({ message: `Dealer status updated to ${verificationStatus}` }, { status: 200 });

    } catch (error) {
        console.error('Error updating dealer status (PUT):', error);
        return NextResponse.json({ error: 'Failed to update dealer status', details: (error as Error).message }, { status: 500 });
    }
}