// src/app/api/dashboardPagesAPI/reports/sales-orders/route.ts
import 'server-only';
import { connection, NextResponse, NextRequest } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dealers, salesOrders } from '../../../../../../drizzle';
import { eq, desc, and, or, ilike, getTableColumns, count, SQL, gte, lte } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesOrderSchema } from '../../../../../../drizzle/zodSchemas';
import { verifySession } from '@/lib/auth';

const frontendSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string(),
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
  userRole?: string | null;
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
  area: string | null,
  region: string | null,
  startDate: string | null,
  endDate: string | null
) {
  'use cache';
  cacheLife('hours');
  cacheTag(`sales-orders-${companyId}`);

  const filterKey = `${search}-${area}-${region}-${startDate}-${endDate}`;
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

  if (area) filters.push(eq(dealers.area, area));
  if (region) filters.push(eq(dealers.region, region));

  if (startDate) filters.push(gte(salesOrders.orderDate, startDate));
  if (endDate) filters.push(lte(salesOrders.orderDate, endDate));

  const whereClause = and(...filters);

  const results: SalesOrderRow[] = await db
    .select({
      ...getTableColumns(salesOrders),
      userFirstName: users.firstName,
      userLastName: users.lastName,
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
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.permissions.includes("READ")) {
      return NextResponse.json({ error: 'Forbidden: READ access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? 0);
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 500), 500);

    const search = searchParams.get('search');
    const area = searchParams.get('area');
    const region = searchParams.get('region');

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const result = await getCachedSalesOrders(
      session.companyId,
      page,
      pageSize,
      search,
      area,
      region,
      startDate,
      endDate
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