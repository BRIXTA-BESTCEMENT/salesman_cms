// src/app/api/dashboardPagesAPI/admin-app-reports/outstanding/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { outstandingReports, verifiedDealers } from '../../../../../../drizzle/schema';
import { eq, and, desc, asc, SQL, getTableColumns, gte, lte, sql, ilike, or } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

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

        // --- Helpers ---
        const numberish = (v: unknown) => {
            if (v === null || v === undefined || v === '') return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        // ✅ GET BY ID
        if (action === 'by_id') {
            const id = q.id;
            if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });

            const [record] = await db.select({
                ...getTableColumns(outstandingReports),
                dealerPartyName: verifiedDealers.dealerPartyName,
                zone: verifiedDealers.zone
            })
                .from(outstandingReports)
                .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id))
                .where(eq(outstandingReports.id, id))
                .limit(1);

            if (!record) return NextResponse.json({ success: false, error: 'Outstanding Report not found' }, { status: 404 });
            return NextResponse.json({ success: true, data: record });
        }

        // ✅ LATEST BY VERIFIED DEALER ID
        if (action === 'latest_dealer') {
            const verifiedDealerId = parseInt(q.dealerId, 10);
            if (isNaN(verifiedDealerId)) return NextResponse.json({ success: false, error: 'Invalid Dealer ID' }, { status: 400 });

            const [latestReport] = await db.select()
                .from(outstandingReports)
                .where(eq(outstandingReports.verifiedDealerId, verifiedDealerId))
                .orderBy(desc(outstandingReports.reportDate))
                .limit(1);

            return NextResponse.json({ success: true, data: latestReport ? [latestReport] : [] });
        }

        // --- Query Builders for List ---
        const booleanish = (v: unknown) => {
            if (v === 'true' || v === '1') return true;
            if (v === 'false' || v === '0') return false;
            return undefined;
        };

        const buildWhere = (): SQL | undefined => {
            const conds: SQL[] = [];
            const dealerId = numberish(q.verifiedDealerId || (action === 'by_dealer' ? q.dealerId : undefined));
            if (dealerId !== undefined) conds.push(eq(outstandingReports.verifiedDealerId, dealerId));
            if (q.collectionReportId) conds.push(eq(outstandingReports.collectionReportId, String(q.collectionReportId)));
            if (q.dvrId) conds.push(eq(outstandingReports.dvrId, String(q.dvrId)));

            const isOverdue = booleanish(q.isOverdue);
            if (isOverdue !== undefined) conds.push(eq(outstandingReports.isOverdue, isOverdue));

            if (q.reportDate) conds.push(eq(outstandingReports.reportDate, String(q.reportDate)));
            if (q.fromDate) conds.push(gte(outstandingReports.reportDate, q.fromDate));
            if (q.toDate) conds.push(lte(outstandingReports.reportDate, q.toDate));

            if (q.search) {
                const searchStr = `%${q.search}%`;
                conds.push(or(
                    ilike(outstandingReports.dealerName, searchStr),
                    ilike(verifiedDealers.dealerPartyName, searchStr)
                ) as SQL);
            }
            if (q.institution) conds.push(eq(outstandingReports.institution, String(q.institution)));

            return conds.length === 0 ? undefined : (conds.length === 1 ? conds[0] : and(...conds));
        };

        const buildSort = () => {
            const direction = (q.sortDir || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
            const sortFn = direction === 'asc' ? asc : desc;
            switch (q.sortBy) {
                case 'securityDepositAmt': return sortFn(outstandingReports.securityDepositAmt);
                case 'pendingAmt': return sortFn(outstandingReports.pendingAmt);
                case 'reportDate': return sortFn(outstandingReports.reportDate);
                case 'updatedAt': return sortFn(outstandingReports.updatedAt);
                case 'createdAt':
                default: return desc(outstandingReports.createdAt);
            }
        };

        // ✅ LIST VIEW
        const limit = q.limit || '1000';
        const page = q.page || '1';
        const lmt = Math.max(1, Math.min(1000, parseInt(limit, 10) || 1000));
        const pg = Math.max(1, parseInt(page, 10) || 1);
        const offset = (pg - 1) * lmt;

        const whereCondition = buildWhere();
        const orderExpr = buildSort();

        const dataQuery = db.select({
            ...getTableColumns(outstandingReports),
            dealerPartyName: verifiedDealers.dealerPartyName,
            zone: verifiedDealers.zone
        })
            .from(outstandingReports)
            .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id));

        if (whereCondition) dataQuery.where(whereCondition);

        const data = await dataQuery.orderBy(orderExpr).limit(lmt).offset(offset);

        const countQuery = db.select({ count: sql<number>`count(*)` })
            .from(outstandingReports)
            .leftJoin(verifiedDealers, eq(outstandingReports.verifiedDealerId, verifiedDealers.id));

        if (whereCondition) countQuery.where(whereCondition);

        const [totalRes] = await countQuery;
        const total = Number(totalRes?.count || 0);

        return NextResponse.json({
            success: true,
            page: pg,
            limit: lmt,
            total,
            totalPages: Math.ceil(total / lmt),
            count: data.length,
            data
        });

    } catch (error) {
        console.error(`Get Outstanding Reports list error:`, error);
        return NextResponse.json({
            success: false,
            error: `Failed to fetch outstanding reports`,
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}