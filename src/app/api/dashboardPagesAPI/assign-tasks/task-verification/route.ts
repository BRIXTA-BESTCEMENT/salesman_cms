// src/app/api/dashboardPagesAPI/assign-tasks/task-verification/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dailyTasks, dealers } from '../../../../../../drizzle';
import { eq, and, asc, getTableColumns } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import { selectDailyTaskSchema } from '../../../../../../drizzle/zodSchemas';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'regional-sales-manager', 'senior-manager', 'manager', 'assistant-manager',
];

const getISTDate = (date: string | Date | null) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const frontendTaskSchema = selectDailyTaskSchema.extend({
    salesmanName: z.string(),
    salesmanRegion: z.string().nullable().optional(),
    salesmanArea: z.string().nullable().optional(),
    relatedDealerName: z.string().nullable().optional(),
    taskDate: z.string(), 
});

type PendingTaskRow = InferSelectModel<typeof dailyTasks> & {
    salesmanFirstName: string | null;
    salesmanLastName: string | null;
    salesmanEmail: string | null;
    salesmanRegion: string | null;
    salesmanArea: string | null;
    dealerName: string | null;
};

async function getPendingTasks(companyId: number) {
    const results: PendingTaskRow[] = await db
        .select({
            ...getTableColumns(dailyTasks),
            salesmanFirstName: users.firstName,
            salesmanLastName: users.lastName,
            salesmanEmail: users.email,
            salesmanRegion: users.region,
            salesmanArea: users.area,
            dealerName: dealers.name,
        })
        .from(dailyTasks)
        .leftJoin(users, eq(dailyTasks.userId, users.id))
        .leftJoin(dealers, eq(dailyTasks.dealerId, dealers.id))
        .where(
            and(
                eq(users.companyId, companyId),
                eq(dailyTasks.status, 'PENDING'),
            )
        )
        .orderBy(asc(dailyTasks.taskDate));

    return results.map((row) => {
        const salesmanName = `${row.salesmanFirstName || ''} ${row.salesmanLastName || ''}`.trim() || row.salesmanEmail || '';
        const relatedDealerName = row.dealerName ?? row.dealerNameSnapshot ?? null;

        return {
            ...row,
            salesmanName,
            taskDate: getISTDate(row.taskDate),
            relatedDealerName,
            salesmanRegion: row.salesmanRegion,
            salesmanArea: row.salesmanArea,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        };
    });
}

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();
    
    try {
        const claims = await getTokenClaims();
        if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserResult = await db
            .select({ id: users.id, role: users.role, companyId: users.companyId })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const formattedTasks = await getPendingTasks(currentUser.companyId);
        const validatedTasks = z.array(frontendTaskSchema.loose()).safeParse(formattedTasks);

        if (!validatedTasks.success) {
            console.error("GET Response Validation Error:", validatedTasks.error.format());
            return NextResponse.json({ tasks: formattedTasks }, { status: 200 }); 
        }

        return NextResponse.json({ tasks: validatedTasks.data }, { status: 200 });
    } catch (error) {
        console.error('Error fetching pending Tasks:', error);
        return NextResponse.json({ error: 'Failed to fetch', details: (error as Error).message }, { status: 500 });
    }
}