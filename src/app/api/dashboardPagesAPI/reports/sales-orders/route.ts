// src/app/api/dashboardPagesAPI/reports/sales-orders/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { cacheTag, cacheLife } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { salesOrderSchema } from '@/lib/shared-zod-schema';

// Roles allowed to access Sales Orders
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
  'senior-executive', 'executive', 'junior-executive'
];

// 2. The Cached Function
async function getCachedSalesOrders(companyId: number) {
  'use cache';
  cacheLife('hours');
  cacheTag(`sales-orders-${companyId}`);

  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      user: {
        companyId: companyId,
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true, role: true, email: true } },
      dealer: { select: { name: true, type: true, phoneNo: true, address: true, area: true, region: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return salesOrders.map((order: any) => {
    const toNum = (v: any) => (v == null ? null : Number(v));
    const toDate = (d: any) => (d ? new Date(d).toISOString().split('T')[0] : null);

    const qty = toNum(order.orderQty) ?? 0;
    const effPrice = toNum(order.itemPriceAfterDiscount) ?? toNum(order.itemPrice) ?? 0;
    const orderTotal = Number((qty * effPrice).toFixed(2));

    const receivedPayment = toNum(order.receivedPayment);
    const pendingPayment = order.pendingPayment != null
      ? toNum(order.pendingPayment)
      : Number((orderTotal - (receivedPayment ?? 0)).toFixed(2));

    const salesmanName = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || order.user?.email || 'Unknown';

    return {
      id: order.id,
      userId: order.userId ?? null,
      dealerId: order.dealerId ?? null,
      dvrId: order.dvrId ?? null,
      pjpId: order.pjpId ?? null,
      salesmanName,
      salesmanRole: order.user?.role || 'Unknown',
      dealerName: order.dealer?.name || 'Unknown',
      dealerType: order.dealer?.type || 'Unknown',
      dealerPhone: order.dealer?.phoneNo || '',
      dealerAddress: order.dealer?.address || '',
      area: order.dealer?.area || '',
      region: order.dealer?.region || '',
      orderDate: toDate(order.orderDate) as string,
      orderPartyName: order.orderPartyName,
      partyPhoneNo: order.partyPhoneNo ?? null,
      partyArea: order.partyArea ?? null,
      partyRegion: order.partyRegion ?? null,
      partyAddress: order.partyAddress ?? null,
      deliveryDate: toDate(order.deliveryDate),
      deliveryArea: order.deliveryArea ?? null,
      deliveryRegion: order.deliveryRegion ?? null,
      deliveryAddress: order.deliveryAddress ?? null,
      deliveryLocPincode: order.deliveryLocPincode ?? null,
      paymentMode: order.paymentMode ?? null,
      paymentTerms: order.paymentTerms ?? null,
      paymentAmount: toNum(order.paymentAmount),
      receivedPayment,
      receivedPaymentDate: toDate(order.receivedPaymentDate),
      pendingPayment,
      orderQty: toNum(order.orderQty),
      orderUnit: order.orderUnit ?? null,
      itemPrice: toNum(order.itemPrice),
      discountPercentage: toNum(order.discountPercentage),
      itemPriceAfterDiscount: toNum(order.itemPriceAfterDiscount),
      itemType: order.itemType ?? null,
      itemGrade: order.itemGrade ?? null,
      orderTotal,
      estimatedDelivery: toDate(order.deliveryDate),
      remarks: null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  });
}

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();

    // 1. Auth Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Current User Lookup
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true },
    });

    // 3. Role Check
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Your role does not have access to this data.' },
        { status: 403 }
      );
    }

    // 4. Call the cached function
    const formatted = await getCachedSalesOrders(currentUser.companyId);

    const validated = z.array(salesOrderSchema).parse(formatted);

    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders', details: (error as Error).message },
      { status: 500 }
    );
  }
}
