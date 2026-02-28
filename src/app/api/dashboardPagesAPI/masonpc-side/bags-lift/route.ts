// src/app/api/dashboardPagesAPI/masonpc-side/bags-lift/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, bagLifts, masonPcSide, dealers, technicalSites } from '../../../../../../drizzle'; 
import { eq, and, or, ilike, isNull, desc, aliasedTable, sql, SQL, count, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { selectBagLiftSchema } from '../../../../../../drizzle/zodSchemas'; 

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive',
];

async function getCachedBagLifts(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  status: string | null,
  area: string | null,
  region: string | null,
  fromDate: string | null,
  toDate: string | null
) {
  'use cache';
  cacheLife('minutes');
  
  const filterKey = `${search}-${status}-${area}-${region}-${fromDate}-${toDate}`;
  cacheTag(`bags-lift-${companyId}-${page}-${filterKey}`);

  const approvers = aliasedTable(users, 'approvers');
  const salesmen = aliasedTable(users, 'salesmen');

  const filters: SQL[] = [
    or(
        eq(salesmen.companyId, companyId),
        isNull(masonPcSide.userId)
    ) as SQL
  ];

  if (search) {
    const searchCondition = or(
        ilike(masonPcSide.name, `%${search}%`),
        ilike(masonPcSide.phoneNumber, `%${search}%`),
        ilike(dealers.name, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }

  if (status && status !== 'all') filters.push(ilike(bagLifts.status, status));
  if (area && area !== 'all') filters.push(eq(salesmen.area, area));
  if (region && region !== 'all') filters.push(eq(salesmen.region, region));
  if (fromDate) filters.push(gte(bagLifts.purchaseDate, fromDate));
  if (toDate) filters.push(lte(bagLifts.purchaseDate, toDate));

  const whereClause = and(...filters);

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
    .where(whereClause)
    .orderBy(desc(bagLifts.purchaseDate), desc(bagLifts.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(bagLifts)
    .innerJoin(masonPcSide, eq(bagLifts.masonId, masonPcSide.id))
    .leftJoin(salesmen, eq(masonPcSide.userId, salesmen.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formattedData = results.map(({ lift, mason, dealerName, site, approver, salesman }) => {
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

  return { data: formattedData, totalCount };
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const area = searchParams.get('area');
    const region = searchParams.get('region');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const result = await getCachedBagLifts(
        currentUser.companyId,
        page,
        pageSize,
        search,
        status,
        area,
        region,
        fromDate,
        toDate
    );

    const schema = selectBagLiftSchema.loose().extend({
      masonName: z.string(),
      dealerName: z.string().nullable().optional(),
      approverName: z.string().nullable().optional(),
      associatedSalesmanName: z.string().nullable().optional(),
      siteName: z.string().nullable().optional(),
      siteAddress: z.string().nullable().optional(),
      role: z.string().optional(),
      area: z.string().optional(),
      region: z.string().optional(),
      purchaseDate: z.string(),
      createdAt: z.string(),
      approvedAt: z.string().nullable().optional(),
    });

    const validatedData = z.array(schema).safeParse(result.data);

    if (!validatedData.success) {
      console.error("Bag Lifts Validation Error:", validatedData.error.format());
      return NextResponse.json({ data: result.data, totalCount: result.totalCount, page, pageSize });
    }

    return NextResponse.json({
        data: validatedData.data,
        totalCount: result.totalCount,
        page,
        pageSize
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}