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
import { eq, desc, inArray, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectTechnicalSiteSchema } from '../../../../../drizzle/zodSchemas';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive',
];

// 1. Extend the baked DB schema to strictly type the nested relations and parsed dates/numbers
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

// Explicit type to survive 'use cache' boundary collapse
type SiteRow = InferSelectModel<typeof technicalSites>;

// 2. The Cached Function
async function getCachedTechnicalSites() {
    'use cache';
    cacheLife('days');
    cacheTag('technical-sites');

    // Step 1: Fetch base sites cleanly
    const sites: SiteRow[] = await db
        .select({ ...getTableColumns(technicalSites) })
        .from(technicalSites)
        .orderBy(desc(technicalSites.updatedAt));

    if (sites.length === 0) return [];

    const siteIds = sites.map(s => s.id);

    // Step 2: Fetch all relations in 4 parallel, batched queries using `inArray` (Fixes N+1 issue)
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
    return sites.map(site => {
        // Safe access to grouped maps
        const siteUsers = usersMap[site.id] || [];
        const siteDealers = dealersMap[site.id] || [];
        const siteMasons = masonsMap[site.id] || [];
        const siteBagLifts = bagLiftsMap[site.id] || [];

        // Support for both typo variants that might exist in schema vs frontend ('firstVisitDate' vs 'firstVistDate')
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

        const formattedSites = await getCachedTechnicalSites();

        // Validate strictly with our extended schema
        const validatedData = z.array(frontendSiteSchema).safeParse(formattedSites);

        if (!validatedData.success) {
            console.error("Technical Sites Validation Error:", validatedData.error.format());
            // Graceful fallback to avoid crashing the dashboard view
            return NextResponse.json(formattedSites, { status: 200 });
        }

        return NextResponse.json(validatedData.data, { status: 200 });

    } catch (error) {
        console.error('Error fetching technical sites:', error);
        return NextResponse.json({
            error: 'Failed to fetch technical sites',
            details: (error as Error).message
        }, { status: 500 });
    }
}