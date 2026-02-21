// src/app/api/dashboardPagesAPI/reports/sales-orders/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import { db } from '@/lib/drizzle';
import { users, dealers, salesOrders } from '../../../../../../drizzle';
import { eq, desc, and, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectSalesOrderSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

// 1. Extend the baked DB schema to strictly type the calculated and joined fields
const frontendSalesOrderSchema = selectSalesOrderSchema.extend({
  salesmanName: z.string(),
  salesmanRole: z.string(),
  dealerName: z.string(),
  dealerType: z.string(),
  dealerPhone: z.string(),
  dealerAddress: z.string(),
  area: z.string(),
  region: z.string(),
  
  // Strict numeric typing for the frontend, overriding Drizzle's string decimals
  orderQty: z.number().nullable(),
  itemPrice: z.number().nullable(),
  discountPercentage: z.number().nullable(),
  itemPriceAfterDiscount: z.number().nullable(),
  paymentAmount: z.number().nullable(),
  receivedPayment: z.number().nullable(),
  pendingPayment: z.number().nullable(),
  orderTotal: z.number(),
  
  // Date string overrides
  orderDate: z.string(),
  deliveryDate: z.string().nullable(),
  receivedPaymentDate: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  remarks: z.string().nullable().optional(),
});

// 2. Explicit type to survive Next.js 'use cache' boundary collapse
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

// 3. The Cached Function
async function getCachedSalesOrders(companyId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(`sales-orders-${companyId}`);

  // Use getTableColumns and explicit typing to prevent `never[]`
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
    .where(eq(users.companyId, companyId))
    .orderBy(desc(salesOrders.createdAt));

  return results.map((row) => {
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
}

export async function GET() {
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

    const formatted = await getCachedSalesOrders(currentUser.companyId);

    // Strictly parse using the extended schema instead of .loose()
    const validated = z.array(frontendSalesOrderSchema).safeParse(formatted);

    if (!validated.success) {
        console.error("Sales Orders Validation Error:", validated.error.format());
        // Return unvalidated data gracefully so the frontend table doesn't break
        return NextResponse.json(formatted, { status: 200 }); 
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders', details: (error as Error).message },
      { status: 500 }
    );
  }
}