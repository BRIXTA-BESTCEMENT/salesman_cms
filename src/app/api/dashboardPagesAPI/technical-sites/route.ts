// src/app/api/dashboardPagesAPI/technical-sites/route.ts
import 'server-only';
import { connection, NextRequest, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { technicalSiteSchema } from '@/lib/shared-zod-schema';
import { Prisma } from '../../../../../prisma/generated/client';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive',
];

// 2. The Cached Function
async function getCachedTechnicalSites() {
    'use cache';
    cacheLife('days');
    cacheTag('technical-sites'); // Since sites don't have a direct companyId in your schema right now

    const sites = await prisma.technicalSite.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            associatedUsers: { select: { id: true, firstName: true, lastName: true, role: true, phoneNumber: true } },
            associatedDealers: { select: { id: true, name: true, phoneNo: true, type: true, area: true } },
            associatedMasons: { select: { id: true, name: true, phoneNumber: true, kycStatus: true } },
            bagLifts: { select: { id: true, bagCount: true, pointsCredited: true, status: true, purchaseDate: true, mason: { select: { name: true } } }, orderBy: { purchaseDate: 'desc' } }
        }
    });

    function toNumberOrNull(val: Prisma.Decimal | null | number): number | null {
        if (val === null || val === undefined) return null;
        if (typeof val === 'object' && 'toNumber' in val) return val.toNumber();
        return Number(val);
    }

    return sites.map((site) => ({
        id: site.id,
        siteName: site.siteName,
        concernedPerson: site.concernedPerson,
        phoneNo: site.phoneNo,
        address: site.address,
        latitude: toNumberOrNull(site.latitude),
        longitude: toNumberOrNull(site.longitude),
        siteType: site.siteType,
        area: site.area,
        region: site.region,
        keyPersonName: site.keyPersonName,
        keyPersonPhoneNum: site.keyPersonPhoneNum,
        stageOfConstruction: site.stageOfConstruction,
        convertedSite: site.convertedSite,
        needFollowUp: site.needFollowUp,
        imageUrl: site.imageUrl,
        constructionStartDate: site.constructionStartDate?.toISOString() ?? null,
        constructionEndDate: site.constructionEndDate?.toISOString() ?? null,
        firstVistDate: site.firstVistDate?.toISOString() ?? null,
        lastVisitDate: site.lastVisitDate?.toISOString() ?? null,
        createdAt: site.createdAt.toISOString(),
        updatedAt: site.updatedAt.toISOString(),

        associatedUsers: site.associatedUsers.map(u => ({
            id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown', role: u.role, phoneNumber: u.phoneNumber
        })),
        associatedDealers: site.associatedDealers.map(d => ({
            id: d.id, name: d.name, phoneNo: d.phoneNo, type: d.type, area: d.area
        })),
        associatedMasons: site.associatedMasons.map(m => ({
            id: m.id, name: m.name, phoneNumber: m.phoneNumber, kycStatus: m.kycStatus
        })),
        bagLifts: site.bagLifts.map(bl => ({
            id: bl.id, bagCount: bl.bagCount, pointsCredited: bl.pointsCredited, status: bl.status, purchaseDate: bl.purchaseDate.toISOString(), masonName: bl.mason?.name ?? null
        })),
    }));
}

export async function GET(request: NextRequest) {
    await connection();
    try {
        const claims = await getTokenClaims();

        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true }
        });

        // 3. Authorization Check
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get Cached Sites
        const formattedSites = await getCachedTechnicalSites();

        // Validate with Zod
        const validatedData = z.array(technicalSiteSchema).parse(formattedSites);

        return NextResponse.json(validatedData, { status: 200 });

    } catch (error) {
        console.error('Error fetching technical sites:', error);
        return NextResponse.json({
            error: 'Failed to fetch technical sites',
            details: (error as Error).message
        }, { status: 500 });
    }
}