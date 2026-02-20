// src/app/api/dashboardPagesAPI/dealerManagement/verified-dealers/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { getVerifiedDealersSchema } from '@/lib/shared-zod-schema'; // Ensure this path matches

// Roles allowed to view verified dealers
const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

// 1. Create the cached function
async function getCachedVerifiedDealers(companyId: number) {
    'use cache';
    cacheLife('days');
    cacheTag(`verified-dealers-${companyId}`); // Unique tag

    const verifiedDealers = await prisma.verifiedDealer.findMany({
        where: {
            OR: [
                { userId: null },
                { user: { companyId: companyId } }
            ]
        },
        include: { 
            dealer: { select: { id: true, name: true, verificationStatus: true } },
        },
        orderBy: { id: 'desc' },
    });

    return verifiedDealers.map(vd => ({
        id: vd.id,
            dealerCode: vd.dealerCode ?? null,
            dealerCategory: vd.dealerCategory ?? null,
            isSubdealer: vd.isSubdealer ?? null,
            dealerPartyName: vd.dealerPartyName ?? null,
            zone: vd.zone ?? null,
            area: vd.area ?? null,
            contactNo1: vd.contactNo1 ?? null,
            contactNo2: vd.contactNo2 ?? null,
            email: vd.email ?? null,
            address: vd.address ?? null,
            pinCode: vd.pinCode ?? null,
            relatedSpName: vd.relatedSpName ?? null,
            ownerProprietorName: vd.ownerProprietorName ?? null,
            natureOfFirm: vd.natureOfFirm ?? null,
            gstNo: vd.gstNo ?? null,
            panNo: vd.panNo ?? null,
            userId: vd.userId ?? null,
            dealerId: vd.dealerId ?? null,
            dealer: vd.dealer ? {
                id: vd.dealer.id,
                name: vd.dealer.name,
                verificationStatus: vd.dealer.verificationStatus,
            } : null
    }));
}

export async function GET() {
    await connection();
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to get their ID, role, and company
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true }
        });

        // 3. Role-based Authorization
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: `Forbidden: Only authorized roles can view verified dealers.` }, 
                { status: 403 }
            );
        }

        // 4. --- FETCH FROM CACHE ---
        const formattedDealers = await getCachedVerifiedDealers(currentUser.companyId);

        // 6. Validate the formatted data against the Zod schema array
        const validatedDealers = z.array(getVerifiedDealersSchema).parse(formattedDealers);

        // Return the validated data
        return NextResponse.json(validatedDealers, { status: 200 });

    } catch (error) {
        console.error('Error fetching verified dealers (GET):', error);
        
        // Return 400 with exact Zod formatting issues if validation fails
        if (error instanceof z.ZodError) {
             return NextResponse.json(
                { error: 'Data validation failed', issues: error.format() }, 
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to fetch verified dealers', details: (error as Error).message }, 
            { status: 500 }
        );
    }
}