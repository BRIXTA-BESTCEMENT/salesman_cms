// src/app/api/dashboardPagesAPI/logistics-io/logistics-users/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, logisticsUsers } from '../../../../../../drizzle';
import { eq, and, or, ilike, desc, getTableColumns, count, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { generateRandomPassword } from '../../users-and-team/users/route';
import { selectLogisticsUsersSchema } from '../../../../../../drizzle/zodSchemas';
import { refreshCompanyCache } from '@/app/actions/cache';

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive', 'executive', 'junior-executive'
];

// Extend the zod schema if necessary for frontend formatting
const frontendLogisticsUserSchema = selectLogisticsUsersSchema.extend({
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
});

// --- CACHED FETCH FUNCTION ---
async function getCachedLogisticsUsers(
    page: number,
    pageSize: number,
    search: string | null,
    roleFilter: string | null,
) {
    'use cache';
    cacheLife('days');

    const filterKey = `${search}-${roleFilter}`;
    cacheTag(`logisticsUsers-${page}-${filterKey}`);

    const userColumns = getTableColumns(logisticsUsers);

    const filters: SQL[] = [];

    if (search) {
        const searchCondition = or(
            ilike(logisticsUsers.userName, `%${search}%`),
            ilike(logisticsUsers.sourceName, `%${search}%`)
        );
        if (searchCondition) filters.push(searchCondition);
    }

    if (roleFilter) {
        filters.push(eq(logisticsUsers.userRole, roleFilter));
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const rawUsers = await db
        .select({ ...userColumns })
        .from(logisticsUsers)
        .where(whereClause)
        .orderBy(desc(logisticsUsers.createdAt))
        .limit(pageSize)
        .offset(page * pageSize);

    const totalCountResult = await db
        .select({ count: count(logisticsUsers.id) })
        .from(logisticsUsers)
        .where(whereClause);

    const totalCount = Number(totalCountResult[0]?.count ?? 0);

    const formattedData = rawUsers.map((row) => ({
        ...row,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    }));

    return { data: formattedData, totalCount };
}

export async function GET(request: NextRequest) {
    if (typeof connection === 'function') await connection();

    try {
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only authorized roles can access logistics users.` }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = Number(searchParams.get('page') ?? 0);
        const pageSize = Math.min(Number(searchParams.get('pageSize') ?? 50), 500);

        const search = searchParams.get('search');
        const roleFilter = searchParams.get('role');

        const result = await getCachedLogisticsUsers(page, pageSize, search, roleFilter);

        const validatedUsers = z.array(frontendLogisticsUserSchema).safeParse(result.data);

        if (!validatedUsers.success) {
            console.error("LogisticsUsers GET Validation Error:", validatedUsers.error.format());
            // Fallback to unvalidated data to prevent complete UI crash
            return NextResponse.json({ data: result.data, totalCount: result.totalCount, page, pageSize }, { status: 200 });
        }

        return NextResponse.json({
            data: validatedUsers.data,
            totalCount: result.totalCount,
            page,
            pageSize
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching logistics users (GET):', error);
        return NextResponse.json({ error: 'Failed to fetch logistics users', details: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only authorized roles can add logistics users.` }, { status: 403 });
        }

        const body = await request.json();

        // Validate incoming body (expecting sourceName, userName, userRole)
        const incomingSchema = z.object({
            sourceName: z.string().optional().nullable(),
            userName: z.string().min(3),
            userRole: z.string().min(1),
        });

        const parsedBody = incomingSchema.safeParse(body);

        if (!parsedBody.success) {
            console.error('Add Logistics User Validation Error (POST):', parsedBody.error.format());
            return NextResponse.json({ message: 'Invalid request body', errors: parsedBody.error.format() }, { status: 400 });
        }

        const { sourceName, userName, userRole } = parsedBody.data;

        let tempPasswordPlaintext = generateRandomPassword();

        const newUserResult = await db.insert(logisticsUsers).values({
            id: crypto.randomUUID(),
            sourceName: sourceName || null,
            userName: userName,
            userPassword: tempPasswordPlaintext, 
            userRole: userRole,
        }).returning();

        const newUser = newUserResult[0];

        // Refresh cache so the new user appears in the table immediately
        await refreshCompanyCache('logisticsUsers');

        // Note: Returning the password here so the Admin UI can display it once to copy/share with the actual user
        return NextResponse.json({ 
            message: 'Logistics User created successfully!', 
            user: newUser 
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding logistics user (POST):', error);
        // Catch unique constraint violations (e.g., duplicate userName)
        if ((error as any).code === '23505') {
            return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to add logistics user', details: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const claims = await getTokenClaims();

        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUserResult = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.workosUserId, claims.sub))
            .limit(1);

        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only authorized roles can delete logistics users.` }, { status: 403 });
        }

        const url = new URL(request.url);
        const userId = url.searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: 'Missing user ID in request' }, { status: 400 });
        }

        const userToDeleteResult = await db
            .select({ id: logisticsUsers.id })
            .from(logisticsUsers)
            .where(eq(logisticsUsers.id, userId))
            .limit(1);

        const userToDelete = userToDeleteResult[0];

        if (!userToDelete) {
            return NextResponse.json({ error: 'Logistics User not found' }, { status: 404 });
        }

        await db
            .delete(logisticsUsers)
            .where(eq(logisticsUsers.id, userId));

        await refreshCompanyCache('logisticsUsers');

        return NextResponse.json({ message: 'Logistics User deleted successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error deleting logistics user (DELETE):', error);
        return NextResponse.json({ error: 'Failed to delete logistics user', details: (error as Error).message }, { status: 500 });
    }
}