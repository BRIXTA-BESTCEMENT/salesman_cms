// src/app/api/dashboardPagesAPI/reports/sales-orders/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dealers, salesOrders } from '../../../../../../drizzle';
import { eq, desc, and, or, ilike, getTableColumns, count, SQL } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesOrderSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

const frontendSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string(),
  salesmanRole: z.string(),
  dealerName: z.string(),
  dealerType: z.string(),
  dealerPhone: z.string(),
  dealerAddress: z.string(),
  area: z.string(),
  region: z.string(),
  
  orderQty: z.number().nullable(),
  itemPrice: z.number().nullable(),
  discountPercentage: z.number().nullable(),
  itemPriceAfterDiscount: z.number().nullable(),
  paymentAmount: z.number().nullable(),
  receivedPayment: z.number().nullable(),
  pendingPayment: z.number().nullable(),
  orderTotal: z.number(),
  
  orderDate: z.string(),
  deliveryDate: z.string().nullable(),
  receivedPaymentDate: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  remarks: z.string().nullable().optional(),
});

type SalesOrderRow = InferSelectModel<typeof salesOrders> & {
  userFirstName: string | null;
  userLastName: string | null;
  userRole: string | null;
  userEmail: string | null;
  dealerNameStr: string | null;
  dealerType: string | null;
  dealerPhone: string | null;
  dealerAddress: string | null;
  dealerArea: string | null;
  dealerRegion: string | null;
};

async function getCachedSalesOrders(
  companyId: number,
  page: number,
  pageSize: number,
  search: string | null,
  role: string | null,
  area: string | null,
  region: string | null
) {
  'use cache';
  cacheLife('hours');
  
  const filterKey = `${search}-${role}-${area}-${region}`;
  cacheTag(`sales-orders-${companyId}-${page}-${filterKey}`);

  const filters: SQL[] = [eq(users.companyId, companyId)];

  if (search) {
    const searchCondition = or(
      ilike(users.firstName, `%${search}%`),
      ilike(users.lastName, `%${search}%`),
      ilike(dealers.name, `%${search}%`)
    );
    if (searchCondition) filters.push(searchCondition);
  }
  
  if (role) filters.push(eq(users.role, role));
  if (area) filters.push(eq(dealers.area, area));
  if (region) filters.push(eq(dealers.region, region));

  const whereClause = and(...filters);

  const results: SalesOrderRow[] = await db
    .select({
      ...getTableColumns(salesOrders),
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userRole: users.role,
      userEmail: users.email,
      dealerNameStr: dealers.name,
      dealerType: dealers.type,
      dealerPhone: dealers.phoneNo,
      dealerAddress: dealers.address,
      dealerArea: dealers.area,
      dealerRegion: dealers.region,
    })
    .from(salesOrders)
    .leftJoin(users, eq(salesOrders.userId, users.id))
    .leftJoin(dealers, eq(salesOrders.dealerId, dealers.id))
    .where(whereClause)
    .orderBy(desc(salesOrders.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  const totalCountResult = await db
    .select({ count: count() })
    .from(salesOrders)
    .leftJoin(users, eq(salesOrders.userId, users.id))
    .leftJoin(dealers, eq(salesOrders.dealerId, dealers.id))
    .where(whereClause);

  const totalCount = Number(totalCountResult[0].count);

  const formatted = results.map((row) => {
    const toNum = (v: any) => (v == null ? null : Number(v));
    const toDate = (d: any) => (d ? new Date(d).toISOString().split('T')[0] : null);

    const qty = toNum(row.orderQty) ?? 0;
    const effPrice = toNum(row.itemPriceAfterDiscount) ?? toNum(row.itemPrice) ?? 0;
    const orderTotal = Number((qty * effPrice).toFixed(2));

    const receivedPayment = toNum(row.receivedPayment);
    const pendingPayment = row.pendingPayment != null
      ? toNum(row.pendingPayment)
      : Number((orderTotal - (receivedPayment ?? 0)).toFixed(2));

    const salesmanName = `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || row.userEmail || 'Unknown';

    return {
      ...row,
      salesmanName,
      salesmanRole: row.userRole || 'Unknown',
      dealerName: row.dealerNameStr || 'Unknown',
      dealerType: row.dealerType || 'Unknown',
      dealerPhone: row.dealerPhone || '',
      dealerAddress: row.dealerAddress || '',
      area: row.dealerArea || '',
      region: row.dealerRegion || '',
      
      orderDate: toDate(row.orderDate) as string,
      deliveryDate: toDate(row.deliveryDate),
      receivedPaymentDate: toDate(row.receivedPaymentDate),
      estimatedDelivery: toDate(row.deliveryDate),
      
      paymentAmount: toNum(row.paymentAmount),
      receivedPayment,
      pendingPayment,
      orderQty: toNum(row.orderQty),
      itemPrice: toNum(row.itemPrice),
      discountPercentage: toNum(row.discountPercentage),
      itemPriceAfterDiscount: toNum(row.itemPriceAfterDiscount),
      orderTotal,
      
      remarks: null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  return { data: formatted, totalCount };
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
        { error: 'Forbidden: Your role does not have access to this data.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);
    
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const area = searchParams.get('area');
    const region = searchParams.get('region');

    const result = await getCachedSalesOrders(
      currentUser.companyId,
      page,
      pageSize,
      search,
      role,
      area,
      region
    );

    const validated = z.array(frontendSalesOrderSchema).safeParse(result.data);

    if (!validated.success) {
        console.error("Sales Orders Validation Error:", validated.error.format());
        return NextResponse.json({
          data: result.data,
          totalCount: result.totalCount,
          page,
          pageSize
        }, { status: 200 }); 
    }

    return NextResponse.json({
      data: validated.data,
      totalCount: result.totalCount,
      page,
      pageSize
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders', details: (error as Error).message },
      { status: 500 }
    );
  }
}