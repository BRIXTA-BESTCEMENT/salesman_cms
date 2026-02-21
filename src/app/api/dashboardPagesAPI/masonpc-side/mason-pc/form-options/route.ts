// src/app/api/dashboardPagesAPI/masonpc-side/form-options/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers, technicalSites } from '../../../../../../../drizzle';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    // Opt into dynamic rendering for Next.js 15+
    if (typeof connection === 'function') await connection();

    try {
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !currentUser.companyId) {
            return NextResponse.json({ error: 'User/Company not found' }, { status: 403 });
        }

        // 1. Fetch Salesmen (isTechnicalRole = true)
        const techUsers = await db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName
            })
            .from(users)
            .where(
                and(
                    eq(users.companyId, currentUser.companyId),
                    eq(users.isTechnicalRole, true)
                )
            )
            .orderBy(asc(users.firstName));

        const formattedUsers = techUsers.map((u) => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        }));

        // 2. Fetch Dealers with Region and Area (joined with users to enforce companyId)
        const verifiedDealers = await db
            .select({
                id: dealers.id,
                name: dealers.name,
                region: dealers.region,
                area: dealers.area
            })
            .from(dealers)
            .innerJoin(users, eq(dealers.userId, users.id))
            .where(
                and(
                    eq(users.companyId, currentUser.companyId),
                    eq(dealers.verificationStatus, 'VERIFIED')
                )
            )
            .orderBy(asc(dealers.name));

        const formattedDealers = verifiedDealers.map((d) => ({
            id: d.id,
            name: `${d.name} (${d.region || '-'}, ${d.area || '-'})`,
        }));

        // 3. Fetch Technical Sites (Matches original Prisma behavior of fetching all)
        const sites = await db
            .select({
                id: technicalSites.id,
                siteName: technicalSites.siteName,
                region: technicalSites.region,
                area: technicalSites.area
            })
            .from(technicalSites)
            .orderBy(asc(technicalSites.siteName)); 

        const formattedSites = sites.map((s) => ({
            id: s.id,
            name: `${s.siteName} (${s.region || '-'}, ${s.area || '-'})`
        }));

        return NextResponse.json({
            users: formattedUsers,
            dealers: formattedDealers,
            sites: formattedSites,
        }, { status: 200 });

    } catch (error: any) {
        console.error('Error fetching form options:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}