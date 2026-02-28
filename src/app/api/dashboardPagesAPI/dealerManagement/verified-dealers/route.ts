// src/app/api/dashboardPagesAPI/dealerManagement/verified-dealers/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, verifiedDealers } from '../../../../../../drizzle/schema'; 
import { eq, desc, and, or, ilike, sql, SQL, count } from 'drizzle-orm';
import { z } from 'zod';
import { selectVerifiedDealersSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

const frontendVerifiedDealerSchema = selectVerifiedDealersSchema;

async function getCachedVerifiedDealers(
    page: number,
    pageSize: number,
    search: string | null,
    zone: string | null,
    area: string | null,
    segment: string | null
) {
    'use cache';
    cacheLife('days');
    
    const filterKey = `${search}-${zone}-${area}-${segment}`;
    cacheTag(`verified-dealers-list-${page}-${filterKey}`);

    const filters: SQL[] = [];

    if (search) {
        const searchCondition = or(
            ilike(verifiedDealers.dealerPartyName, `%${search}%`),
            ilike(verifiedDealers.alias, `%${search}%`),
            ilike(verifiedDealers.contactNo1, `%${search}%`)
        );
        if (searchCondition) filters.push(searchCondition);
    }
    
    if (zone) filters.push(eq(verifiedDealers.zone, zone));
    if (area) filters.push(eq(verifiedDealers.area, area));
    if (segment) filters.push(eq(verifiedDealers.dealerSegment, segment));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const results = await db
        .select()
        .from(verifiedDealers)
        .where(whereClause)
        .orderBy(desc(verifiedDealers.id))
        .limit(pageSize)
        .offset(page * pageSize);

    const totalCountResult = await db
        .select({ count: count() })
        .from(verifiedDealers)
        .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    return { data: results, totalCount };
}

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();
    
    try {
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);
            
        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json(
                { error: `Forbidden: Only authorized roles can view verified dealers.` }, 
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        
        // --- Action: Fetch Distinct Filters Layout ---
        const action = searchParams.get('action');
        if (action === 'fetch_filters') {
             const distinctZones = await db.selectDistinct({ zone: verifiedDealers.zone }).from(verifiedDealers);
             const distinctAreas = await db.selectDistinct({ area: verifiedDealers.area }).from(verifiedDealers);
             const distinctSegments = await db.selectDistinct({ segment: verifiedDealers.dealerSegment }).from(verifiedDealers);

             return NextResponse.json({
                 uniqueZones: distinctZones.map(z => z.zone).filter(Boolean).sort(),
                 uniqueAreas: distinctAreas.map(a => a.area).filter(Boolean).sort(),
                 uniqueSegments: distinctSegments.map(s => s.segment).filter(Boolean).sort(),
             }, { status: 200 });
        }

        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
        
        const search = searchParams.get('search');
        const zone = searchParams.get('zone');
        const area = searchParams.get('area');
        const segment = searchParams.get('segment');

        const result = await getCachedVerifiedDealers(
            page,
            pageSize,
            search,
            zone,
            area,
            segment
        );

        const validatedDealers = z.array(frontendVerifiedDealerSchema).safeParse(result.data);

        if (!validatedDealers.success) {
            console.error("Verified Dealers Validation Error:", validatedDealers.error.format());
            return NextResponse.json({
                data: result.data,
                totalCount: result.totalCount,
                page,
                pageSize
            }, { status: 200 }); 
        }

        return NextResponse.json({
            data: validatedDealers.data,
            totalCount: result.totalCount,
            page,
            pageSize
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching verified dealers (GET):', error);
        return NextResponse.json(
            { error: 'Failed to fetch verified dealers', details: (error as Error).message }, 
            { status: 500 }
        );
    }
}