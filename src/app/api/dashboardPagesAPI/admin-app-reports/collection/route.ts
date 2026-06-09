// src/app/api/dashboardPagesAPI/admin-app-reports/collection/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { collectionReports, users, verifiedDealers } from '../../../../../../drizzle/schema';
import { eq, and, desc, asc, gte, lte, SQL, getTableColumns, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';
import { z } from 'zod';

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();
    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = Object.fromEntries(searchParams.entries());
        const action = q.action;

        const numberish = (v: unknown) => {
            if (v === null || v === undefined || v === '') return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        // ✅ GET BY ID
        if (action === 'by_id') {
            const id = q.id;
            const validId = z.string().uuid().safeParse(id);
            if (!validId.success) return NextResponse.json({ success: false, error: "Invalid ID format" }, { status: 400 });

            const [record] = await db.select({
                ...getTableColumns(collectionReports),
                userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
                dealerName: verifiedDealers.dealerPartyName
            })
                .from(collectionReports)
                .leftJoin(users, eq(collectionReports.userId, users.id))
                .leftJoin(verifiedDealers, eq(collectionReports.verifiedDealerId, verifiedDealers.id))
                .where(eq(collectionReports.id, id))
                .limit(1);

            if (!record) return NextResponse.json({ success: false, error: `Collection Report not found` }, { status: 404 });
            return NextResponse.json({ success: true, data: record });
        }

        // --- Query Builders for List ---
        const buildWhere = (): SQL | undefined => {
            const conds: SQL[] = [];
            if (q.institution) conds.push(eq(collectionReports.institution, String(q.institution)));

            const verifiedDealerId = numberish(q.verifiedDealerId);
            if (verifiedDealerId !== undefined) conds.push(eq(collectionReports.verifiedDealerId, verifiedDealerId));

            const userId = numberish(q.userId || (action === 'by_user' ? q.userId : undefined));
            if (userId !== undefined) conds.push(eq(collectionReports.userId, userId));

            const salesPromoterUserId = numberish(q.salesPromoterUserId);
            if (salesPromoterUserId !== undefined) conds.push(eq(collectionReports.salesPromoterUserId, salesPromoterUserId));

            if (q.fromDate) conds.push(gte(collectionReports.voucherDate, q.fromDate));
            if (q.toDate) conds.push(lte(collectionReports.voucherDate, q.toDate));

            return conds.length === 0 ? undefined : (conds.length === 1 ? conds[0] : and(...conds));
        };

        const buildSort = () => {
            const direction = (q.sortDir || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
            switch (q.sortBy) {
                case 'createdAt': return direction === 'asc' ? asc(collectionReports.createdAt) : desc(collectionReports.createdAt);
                case 'voucherDate':
                default: return direction === 'asc' ? asc(collectionReports.voucherDate) : desc(collectionReports.voucherDate);
            }
        };

        // ✅ LIST VIEW (Default & 'by_user' handler)
        const limit = q.limit || '500';
        const page = q.page || '1';
        const lmt = Math.max(1, Math.min(500, parseInt(limit, 10) || 500));
        const pg = Math.max(1, parseInt(page, 10) || 1);
        const offset = (pg - 1) * lmt;

        const whereCondition = buildWhere();
        const orderExpr = buildSort();

        let query = db.select({
            ...getTableColumns(collectionReports),
            userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
            dealerName: verifiedDealers.dealerPartyName
        })
            .from(collectionReports)
            .leftJoin(users, eq(collectionReports.userId, users.id))
            .leftJoin(verifiedDealers, eq(collectionReports.verifiedDealerId, verifiedDealers.id))
            .$dynamic();

        if (whereCondition) {
            query = query.where(whereCondition);
        }

        const data = await query.orderBy(orderExpr).limit(lmt).offset(offset);

        return NextResponse.json({ success: true, page: pg, limit: lmt, count: data.length, data });

    } catch (error) {
        console.error(`Get Collection Reports list error:`, error);
        return NextResponse.json({
            success: false,
            error: `Failed to fetch Collection Reports`,
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}