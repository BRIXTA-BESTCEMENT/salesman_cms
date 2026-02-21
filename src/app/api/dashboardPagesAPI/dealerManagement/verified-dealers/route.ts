// src/app/api/dashboardPagesAPI/dealerManagement/verified-dealers/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers, verifiedDealers } from '../../../../../../drizzle'; 
import { eq, or, isNull, desc, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { selectVerifiedDealersSchema } from '../../../../../../drizzle/zodSchemas'; 

// Roles allowed to view verified dealers
const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

// Extend the baked DB schema to strictly type the nested dealer object
const frontendVerifiedDealerSchema = selectVerifiedDealersSchema.extend({
    dealer: z.object({
        id: z.string(),
        name: z.string(),
        verificationStatus: z.string()
    }).nullable()
});

// 1. Create the cached function
async function getCachedVerifiedDealers(companyId: number) {
    'use cache';
    cacheLife('days');
    cacheTag(`verified-dealers-${companyId}`); 

    // Use getTableColumns to keep the output flat and avoid TS 'never' errors
    const results = await db
        .select({
            ...getTableColumns(verifiedDealers),
            parentDealerId: dealers.id,
            parentDealerName: dealers.name,
            parentDealerStatus: dealers.verificationStatus
        })
        .from(verifiedDealers)
        // Join users to check the company ID filter
        .leftJoin(users, eq(verifiedDealers.userId, users.id))
        // Join dealers to fetch the nested dealer info
        .leftJoin(dealers, eq(verifiedDealers.dealerId, dealers.id))
        .where(
            or(
                isNull(verifiedDealers.userId),
                eq(users.companyId, companyId)
            )
        )
        .orderBy(desc(verifiedDealers.id));

    // Map the flattened result back into the nested structure the frontend expects
    return results.map(row => {
        // Destructure to separate the joined columns from the base verifiedDealer columns
        const { parentDealerId, parentDealerName, parentDealerStatus, ...vd } = row;
        
        return {
            ...vd,
            dealer: parentDealerId ? {
                id: parentDealerId,
                name: parentDealerName || 'Unknown',
                verificationStatus: parentDealerStatus || 'PENDING'
            } : null
        };
    });
}

export async function GET() {
    if (typeof connection === 'function') await connection();
    
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to get their ID, role, and company
        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);
            
        const currentUser = currentUserResult[0];

        // 3. Role-based Authorization
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: `Forbidden: Only authorized roles can view verified dealers.` }, 
                { status: 403 }
            );
        }

        // 4. --- FETCH FROM CACHE ---
        const formattedDealers = await getCachedVerifiedDealers(currentUser.companyId);

        // 5. Validate the formatted data against the strictly extended Drizzle-Zod schema
        const validatedDealers = z.array(frontendVerifiedDealerSchema).safeParse(formattedDealers);

        if (!validatedDealers.success) {
            console.error("Verified Dealers Validation Error:", validatedDealers.error.format());
            // Fallback gracefully so the UI doesn't crash entirely if one field goes rogue
            return NextResponse.json(formattedDealers, { status: 200 }); 
        }

        // Return the validated data
        return NextResponse.json(validatedDealers.data, { status: 200 });

    } catch (error) {
        console.error('Error fetching verified dealers (GET):', error);
        
        return NextResponse.json(
            { error: 'Failed to fetch verified dealers', details: (error as Error).message }, 
            { status: 500 }
        );
    }
}