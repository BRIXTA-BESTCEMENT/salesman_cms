// src/app/api/dashboardPagesAPI/dealerManagement/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dealers } from '../../../../../drizzle';
import { eq, and, or, ilike, desc, aliasedTable, getTableColumns, SQL, count } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectDealerSchema } from '../../../../../drizzle/zodSchemas';
import { refreshCompanyCache } from '@/app/actions/cache';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive', 'junior-executive'
];

const frontendDealerSchema = selectDealerSchema.extend({
    totalPotential: z.number(),
    bestPotential: z.number(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    monthlySaleMt: z.number().nullable().optional(),
    projectedMonthlySalesBestCementMt: z.number().nullable().optional(),
    salesGrowthPercentage: z.number().nullable().optional(),
    parentDealerName: z.string().nullable().optional(),
});

type DealerRow = InferSelectModel<typeof dealers> & {
    parentDealerName: string | null;
};

// --- CACHED FETCH FUNCTION ---
async function getCachedDealersByCompany(
    companyId: number,
    page: number,
    pageSize: number,
    search: string | null,
    region: string | null,
    area: string | null,
    type: string | null
) {
    'use cache';
    cacheLife('days');

    const filterKey = `${search}-${region}-${area}-${type}`;
    cacheTag(`dealers-${companyId}-${page}-${filterKey}`);

    const parentDealers = aliasedTable(dealers, 'parentDealers');
    const dealerColumns = getTableColumns(dealers);

    const filters: SQL[] = [
        eq(users.companyId, companyId),
        eq(dealers.verificationStatus, 'VERIFIED')
    ];

    if (search) {
        const searchCondition = or(
            ilike(dealers.name, `%${search}%`),
            ilike(dealers.nameOfFirm, `%${search}%`),
            ilike(dealers.address, `%${search}%`),
            ilike(dealers.phoneNo, `%${search}%`)
        );
        if (searchCondition) filters.push(searchCondition);
    }

    if (region) filters.push(eq(dealers.region, region));
    if (area) filters.push(eq(dealers.area, area));
    if (type) filters.push(eq(dealers.type, type));

    const whereClause = and(...filters);

    const rawDealers: DealerRow[] = await db
        .select({
            ...dealerColumns,
            parentDealerName: parentDealers.name,
        })
        .from(dealers)
        .leftJoin(users, eq(dealers.userId, users.id))
        .leftJoin(parentDealers, eq(dealers.parentDealerId, parentDealers.id))
        .where(whereClause)
        .orderBy(desc(dealers.createdAt))
        .limit(pageSize)
        .offset(page * pageSize);

    const totalCountResult = await db
        .select({ count: count(dealers.id) })
        .from(dealers)
        .leftJoin(users, eq(dealers.userId, users.id))
        .where(whereClause) as { count: number }[];

    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    const toNumber = (val: any) =>
        val === null || val === undefined || val === ''
            ? null
            : Number(val);
    const toStringDate = (val: any) => (val ? new Date(val).toISOString().split('T')[0] : null);

    const formattedData = rawDealers.map((row) => ({
        ...row,
        totalPotential: toNumber(row.totalPotential),
        bestPotential: toNumber(row.bestPotential),
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        monthlySaleMt: row.monthlySaleMt ? Number(row.monthlySaleMt) : null,
        projectedMonthlySalesBestCementMt: row.projectedMonthlySalesBestCementMt ? Number(row.projectedMonthlySalesBestCementMt) : null,
        salesGrowthPercentage: row.salesGrowthPercentage ? Number(row.salesGrowthPercentage) : null,

        dateOfBirth: toStringDate(row.dateOfBirth),
        anniversaryDate: toStringDate(row.anniversaryDate),
        declarationDate: toStringDate(row.declarationDate),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),

        parentDealerName: row.parentDealerName || null,
    }));

    return { data: formattedData, totalCount };
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
            return NextResponse.json({ error: `Forbidden: Only the following roles can access dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

        const search = searchParams.get('search');
        const region = searchParams.get('region');
        const area = searchParams.get('area');
        const type = searchParams.get('type');

        const result = await getCachedDealersByCompany(
            currentUser.companyId,
            page,
            pageSize,
            search,
            region,
            area,
            type
        );

        const validatedDealers = z.array(frontendDealerSchema).safeParse(result.data);

        if (!validatedDealers.success) {
            console.error("Dealer GET Validation Error:", validatedDealers.error.format());
            return NextResponse.json({ data: result.data, totalCount: result.totalCount, page, pageSize }, { status: 200 });
        }

        return NextResponse.json({
            data: validatedDealers.data,
            totalCount: result.totalCount,
            page,
            pageSize
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching dealers (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch dealers', details: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
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
            return NextResponse.json({ error: `Forbidden: Only the following roles can add dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        const body = await request.json();

        const parsedBody = selectDealerSchema.loose().safeParse(body);

        if (!parsedBody.success) {
            console.error('Add Dealer Validation Error (POST):', parsedBody.error.format());
            return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
        }

        const {
            name, type, region, area, phoneNo, address,
            pinCode, dateOfBirth, anniversaryDate,
            totalPotential, bestPotential, brandSelling,
            feedbacks, remarks, parentDealerId,
        } = parsedBody.data;

        // --- GEOCODING SECTION ---
        let latitude: number | null = null;
        let longitude: number | null = null;
        const apiKey = process.env.OPENCAGE_GEO_API;

        if (apiKey) {
            const openCageApiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}`;
            try {
                const geocodeResponse = await fetch(openCageApiUrl);
                if (geocodeResponse.ok) {
                    const geocodeResults = await geocodeResponse.json();
                    if (geocodeResults.results.length > 0) {
                        latitude = geocodeResults.results[0].geometry.lat;
                        longitude = geocodeResults.results[0].geometry.lng;
                        console.log(`Successfully geocoded address to: ${latitude}, ${longitude}`);
                    }
                } else {
                    console.error('Geocoding failed. HTTP Status:', geocodeResponse.status);
                }
            } catch (geocodeError) {
                console.error('An error occurred during geocoding:', geocodeError);
            }
        } else {
            console.warn('OPENCAGE_GEO_API key not set. Skipping geocoding.');
        }

        const newDealerResult = await db.insert(dealers).values({
            id: crypto.randomUUID(),
            userId: currentUser.id,
            name: name,
            type: type,
            region: region,
            area: area,
            phoneNo: phoneNo,
            address: address,
            pinCode,
            latitude: latitude?.toString() ?? null,
            longitude: longitude?.toString() ?? null,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString().split('T')[0] : null,
            anniversaryDate: anniversaryDate ? new Date(anniversaryDate).toISOString().split('T')[0] : null,
            totalPotential: totalPotential?.toString() ?? null,
            bestPotential: bestPotential?.toString() ?? null,
            brandSelling: brandSelling,
            feedbacks: feedbacks,
            remarks: remarks,
            parentDealerId: parentDealerId || null,
        }).returning();

        const newDealer = newDealerResult[0];

        await refreshCompanyCache('dealers');

        return NextResponse.json({ message: 'Dealer added successfully!', dealer: newDealer }, { status: 201 });
    } catch (error) {
        console.error('Error adding dealer (POST):', error);
        return NextResponse.json({ error: 'Failed to add dealer', details: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
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
            return NextResponse.json({ error: `Forbidden: Only the following roles can delete dealers: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        const url = new URL(request.url);
        const dealerId = url.searchParams.get('id');

        if (!dealerId) {
            return NextResponse.json({ error: 'Missing dealer ID in request' }, { status: 400 });
        }

        const dealerToDeleteResult = await db
            .select({ id: dealers.id, userCompanyId: users.companyId })
            .from(dealers)
            .leftJoin(users, eq(dealers.userId, users.id))
            .where(eq(dealers.id, dealerId))
            .limit(1);

        const dealerToDelete = dealerToDeleteResult[0];

        if (!dealerToDelete) {
            return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
        }

        if (dealerToDelete.userCompanyId !== currentUser.companyId) {
            return NextResponse.json({ error: 'Forbidden: Cannot delete a dealer from another company' },
                { status: 403 });
        }

        await db
            .delete(dealers)
            .where(eq(dealers.id, dealerId));

        await refreshCompanyCache('dealers');

        return NextResponse.json({ message: 'Dealer deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error deleting dealer (DELETE):', error);
        return NextResponse.json({ error: 'Failed to delete dealer', details: (error as Error).message }, { status: 500 });
    }
}