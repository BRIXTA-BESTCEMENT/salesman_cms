// src/app/api/dashboardPagesAPI/masonpc-side/bags-lift/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, bagLifts, masonPcSide, dealers, technicalSites } from '../../../../../../drizzle'; 
import { eq, and, or, isNull, desc, aliasedTable } from 'drizzle-orm';
import { z } from 'zod';
import { selectBagLiftSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

async function getCachedBagLifts(companyId: number) {
  'use cache';
  cacheLife('minutes');
  cacheTag(`bags-lift-${companyId}`);

  const approvers = aliasedTable(users, 'approvers');
  const salesmen = aliasedTable(users, 'salesmen');

  const results = await db
    .select({
      lift: bagLifts,
      mason: {
          name: masonPcSide.name,
          phoneNumber: masonPcSide.phoneNumber,
      },
      dealerName: dealers.name,
      site: {
          siteName: technicalSites.siteName,
          address: technicalSites.address
      },
      approver: {
          firstName: approvers.firstName,
          lastName: approvers.lastName,
          email: approvers.email
      },
      salesman: {
          firstName: salesmen.firstName,
          lastName: salesmen.lastName,
          email: salesmen.email,
          role: salesmen.role,
          area: salesmen.area,
          region: salesmen.region
      }
    })
    .from(bagLifts)
    .innerJoin(masonPcSide, eq(bagLifts.masonId, masonPcSide.id))
    .leftJoin(salesmen, eq(masonPcSide.userId, salesmen.id))
    .leftJoin(dealers, eq(bagLifts.dealerId, dealers.id))
    .leftJoin(technicalSites, eq(bagLifts.siteId, technicalSites.id))
    .leftJoin(approvers, eq(bagLifts.approvedBy, approvers.id))
    .where(
        or(
            eq(salesmen.companyId, companyId),
            isNull(masonPcSide.userId)
        )
    )
    .orderBy(desc(bagLifts.purchaseDate))
    .limit(1000);

  return results.map(({ lift, mason, dealerName, site, approver, salesman }) => {
    const formatName = (u: any) => u ? (`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email) : null;

    return {
      ...lift,
      masonName: mason.name,
      phoneNumber: mason.phoneNumber,
      dealerName: dealerName || null,
      approverName: formatName(approver),
      associatedSalesmanName: formatName(salesman),
      siteName: site?.siteName || null,
      siteAddress: site?.address || null,
      role: salesman?.role || 'N/A',
      area: salesman?.area || 'N/A',
      region: salesman?.region || 'N/A',
      purchaseDate: lift.purchaseDate ? new Date(lift.purchaseDate).toISOString() : '',
      createdAt: new Date(lift.createdAt).toISOString(),
      approvedAt: lift.approvedAt ? new Date(lift.approvedAt).toISOString() : null,
    };
  });
}

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUserResult = await db
      .select({ role: users.role, companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];
    if (!currentUser || !allowedRoles.includes(currentUser.role)) return NextResponse.json({ error: `Forbidden` }, { status: 403 });

    const formattedReports = await getCachedBagLifts(currentUser.companyId);
    return NextResponse.json(z.array(selectBagLiftSchema.loose()).parse(formattedReports));
    
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}