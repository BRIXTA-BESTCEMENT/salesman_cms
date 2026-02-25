import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, verifiedDealers } from '../../../../../../drizzle/schema'; // Adjusted to remove 'dealers'
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { selectVerifiedDealersSchema } from '../../../../../../drizzle/zodSchemas'; 

// Roles allowed to view verified dealers
const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

// We no longer need to extend the schema with the nested dealer object 
// since the dealerId foreign key was removed.
const frontendVerifiedDealerSchema = selectVerifiedDealersSchema;

// 1. Create the cached function
async function getCachedVerifiedDealers() {
    'use cache';
    cacheLife('days');
    cacheTag(`verified-dealers-list`); // Removed companyId scoping since direct relation is gone

    // Select directly from the verifiedDealers table
    const results = await db
        .select()
        .from(verifiedDealers)
        .orderBy(desc(verifiedDealers.id));

    return results;
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
        const formattedDealers = await getCachedVerifiedDealers();

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