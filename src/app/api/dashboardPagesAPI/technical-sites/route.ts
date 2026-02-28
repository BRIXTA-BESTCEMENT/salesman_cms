// src/app/api/dashboardPagesAPI/technical-sites/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import {
    users, technicalSites, siteAssociatedUsers, siteAssociatedDealers, dealers,
    siteAssociatedMasons, masonPcSide, bagLifts
} from '../../../../../drizzle'; 
import { eq, desc, inArray, getTableColumns, and, or, ilike, count, SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectTechnicalSiteSchema } from '../../../../../drizzle/zodSchemas';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive',
];

const frontendSiteSchema = selectTechnicalSiteSchema.extend({
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    constructionStartDate: z.string().nullable(),
    constructionEndDate: z.string().nullable(),
    firstVisitDate: z.string().nullable(), 
    lastVisitDate: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    associatedUsers: z.array(z.object({
        id: z.number(),
        name: z.string(),
        role: z.string().nullable(),
        phoneNumber: z.string().nullable()
    })),
    associatedDealers: z.array(z.object({
        id: z.string(),
        name: z.string(),
        phoneNo: z.string().nullable(),
        type: z.string().nullable(),
        area: z.string().nullable()
    })),
    associatedMasons: z.array(z.object({
        id: z.string(),
        name: z.string(),
        phoneNumber: z.string().nullable(),
        kycStatus: z.string().nullable()
    })),
    bagLifts: z.array(z.object({
        id: z.string(),
        bagCount: z.number().nullable(),
        pointsCredited: z.number().nullable(),
        status: z.string().nullable(),
        purchaseDate: z.string().nullable(),
        masonName: z.string().nullable()
    })),
});

type SiteRow = InferSelectModel<typeof technicalSites>;

async function getCachedTechnicalSites(
    page: number,
    pageSize: number,
    search: string | null,
    region: string | null,
    area: string | null,
    stage: string | null
) {
    'use cache';
    cacheLife('days');
    
    const filterKey = `${search}-${region}-${area}-${stage}`;
    cacheTag(`technical-sites-${page}-${filterKey}`);

    const filters: SQL[] = [];

    if (search) {
        const searchCondition = or(
            ilike(technicalSites.siteName, `%${search}%`),
            ilike(technicalSites.concernedPerson, `%${search}%`),
            ilike(technicalSites.address, `%${search}%`),
            ilike(technicalSites.phoneNo, `%${search}%`)
        );
        if (searchCondition) filters.push(searchCondition);
    }

    if (region && region !== 'all') filters.push(eq(technicalSites.region, region));
    if (area && area !== 'all') filters.push(eq(technicalSites.area, area));
    if (stage && stage !== 'all') filters.push(eq(technicalSites.stageOfConstruction, stage));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // Step 1: Fetch paginated base sites
    const sites: SiteRow[] = await db
        .select({ ...getTableColumns(technicalSites) })
        .from(technicalSites)
        .where(whereClause)
        .orderBy(desc(technicalSites.updatedAt))
        .limit(pageSize)
        .offset(page * pageSize);

    // Fetch Total Count
    const totalCountResult = await db
        .select({ count: count() })
        .from(technicalSites)
        .where(whereClause);

    const totalCount = Number(totalCountResult[0].count);

    if (sites.length === 0) return { data: [], totalCount };

    const siteIds = sites.map(s => s.id);

    // Step 2: Fetch all relations ONLY for the paginated site IDs (Fixes N+1 issue)
    const [allUsers, allDealers, allMasons, allBagLifts] = await Promise.all([
        db.select({
            siteId: siteAssociatedUsers.a,
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            phoneNumber: users.phoneNumber
        })
        .from(siteAssociatedUsers)
        .innerJoin(users, eq(siteAssociatedUsers.b, users.id))
        .where(inArray(siteAssociatedUsers.a, siteIds)),

        db.select({
            siteId: siteAssociatedDealers.b,
            id: dealers.id,
            name: dealers.name,
            phoneNo: dealers.phoneNo,
            type: dealers.type,
            area: dealers.area
        })
        .from(siteAssociatedDealers)
        .innerJoin(dealers, eq(siteAssociatedDealers.a, dealers.id))
        .where(inArray(siteAssociatedDealers.b, siteIds)),

        db.select({
            siteId: siteAssociatedMasons.b,
            id: masonPcSide.id,
            name: masonPcSide.name,
            phoneNumber: masonPcSide.phoneNumber,
            kycStatus: masonPcSide.kycStatus
        })
        .from(siteAssociatedMasons)
        .innerJoin(masonPcSide, eq(siteAssociatedMasons.a, masonPcSide.id))
        .where(inArray(siteAssociatedMasons.b, siteIds)),

        db.select({
            siteId: bagLifts.siteId,
            id: bagLifts.id,
            bagCount: bagLifts.bagCount,
            pointsCredited: bagLifts.pointsCredited,
            status: bagLifts.status,
            purchaseDate: bagLifts.purchaseDate,
            masonName: masonPcSide.name
        })
        .from(bagLifts)
        .leftJoin(masonPcSide, eq(bagLifts.masonId, masonPcSide.id))
        .where(inArray(bagLifts.siteId, siteIds))
        .orderBy(desc(bagLifts.purchaseDate))
    ]);

    // Step 3: Group relations by siteId in memory for O(1) lookup
    const groupMap = (arr: any[], key: string) => arr.reduce((acc, item) => {
        if (!acc[item[key]]) acc[item[key]] = [];
        acc[item[key]].push(item);
        return acc;
    }, {});

    const usersMap = groupMap(allUsers, 'siteId');
    const dealersMap = groupMap(allDealers, 'siteId');
    const masonsMap = groupMap(allMasons, 'siteId');
    const bagLiftsMap = groupMap(allBagLifts, 'siteId');

    const toNumber = (val: any) => (val ? Number(val) : null);

    // Step 4: Map final results
    const formattedData = sites.map(site => {
        const siteUsers = usersMap[site.id] || [];
        const siteDealers = dealersMap[site.id] || [];
        const siteMasons = masonsMap[site.id] || [];
        const siteBagLifts = bagLiftsMap[site.id] || [];

        const firstVisitRaw = (site as any).firstVisitDate || (site as any).firstVistDate;

        return {
            ...site,
            latitude: toNumber(site.latitude),
            longitude: toNumber(site.longitude),
            constructionStartDate: site.constructionStartDate ? new Date(site.constructionStartDate).toISOString() : null,
            constructionEndDate: site.constructionEndDate ? new Date(site.constructionEndDate).toISOString() : null,
            firstVisitDate: firstVisitRaw ? new Date(firstVisitRaw).toISOString() : null,
            lastVisitDate: site.lastVisitDate ? new Date(site.lastVisitDate).toISOString() : null,
            createdAt: site.createdAt ? new Date(site.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: site.updatedAt ? new Date(site.updatedAt).toISOString() : new Date().toISOString(),

            associatedUsers: siteUsers.map((u: any) => ({
                id: u.id,
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown',
                role: u.role,
                phoneNumber: u.phoneNumber
            })),
            associatedDealers: siteDealers.map((d: any) => ({
                id: d.id, name: d.name, phoneNo: d.phoneNo, type: d.type, area: d.area
            })),
            associatedMasons: siteMasons.map((m: any) => ({
                id: m.id, name: m.name, phoneNumber: m.phoneNumber, kycStatus: m.kycStatus
            })),
            bagLifts: siteBagLifts.map((bl: any) => ({
                id: bl.id, 
                bagCount: toNumber(bl.bagCount), 
                pointsCredited: toNumber(bl.pointsCredited), 
                status: bl.status, 
                purchaseDate: bl.purchaseDate ? new Date(bl.purchaseDate).toISOString() : null,
                masonName: bl.masonName
            })),
        };
    });

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
            .select({ role: users.role })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);

        // --- Action: Fetch Distinct Filters Layout ---
        const action = searchParams.get('action');
        if (action === 'fetch_filters') {
             const distinctRegions = await db.selectDistinct({ region: technicalSites.region }).from(technicalSites);
             const distinctAreas = await db.selectDistinct({ area: technicalSites.area }).from(technicalSites);
             const distinctStages = await db.selectDistinct({ stage: technicalSites.stageOfConstruction }).from(technicalSites);

             return NextResponse.json({
                 regions: distinctRegions.map(r => r.region).filter(Boolean).sort(),
                 areas: distinctAreas.map(a => a.area).filter(Boolean).sort(),
                 stages: distinctStages.map(s => s.stage).filter(Boolean).sort(),
             }, { status: 200 });
        }

        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
        
        const search = searchParams.get('search');
        const region = searchParams.get('region');
        const area = searchParams.get('area');
        const stage = searchParams.get('stage');

        const result = await getCachedTechnicalSites(
            page,
            pageSize,
            search,
            region,
            area,
            stage
        );

        const validatedData = z.array(frontendSiteSchema).safeParse(result.data);

        if (!validatedData.success) {
            console.error("Technical Sites Validation Error:", validatedData.error.format());
            return NextResponse.json({
                data: result.data,
                totalCount: result.totalCount,
                page,
                pageSize
            }, { status: 200 });
        }

        return NextResponse.json({
            data: validatedData.data,
            totalCount: result.totalCount,
            page,
            pageSize
        }, { status: 200 });

    } catch (error) {
        console.error('Error fetching technical sites:', error);
        return NextResponse.json({
            error: 'Failed to fetch technical sites',
            details: (error as Error).message
        }, { status: 500 });
    }
}