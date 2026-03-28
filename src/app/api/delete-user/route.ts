// src/app/api/delete-user/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { users, userRoles } from '../../../../drizzle';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!session.permissions.includes('DELETE')) {
            return NextResponse.json({ error: 'You do not have DELETE permission' }, { status: 403 });
        }

        const body = await request.json();
        const { targetUserId } = body; // We now use the local integer ID

        if (!targetUserId) {
            return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
        }

        // 3. Execution: Transactional Delete
        const result = await db.transaction(async (tx) => {
            // First, ensure the user exists and belongs to the same company as the admin
            const targetUser = await tx
                .select({ id: users.id, companyId: users.companyId })
                .from(users)
                .where(eq(users.id, targetUserId))
                .limit(1);

            if (targetUser.length === 0) {
                throw new Error('User not found');
            }

            // Cross-company deletion prevention
            if (targetUser[0].companyId !== session.companyId) {
                throw new Error('Access denied: Cannot delete users from another company');
            }

            // A. Delete from user_roles join table first (due to foreign key constraints if applicable)
            // Even if your schema has "onDelete: cascade", doing it explicitly in a tx is safer.
            await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));

            // B. Delete the main user record
            await tx.delete(users).where(eq(users.id, targetUserId));

            return { success: true };
        });

        return NextResponse.json({
            message: 'User and associated roles deleted successfully.'
        }, { status: 200 });

    } catch (error: any) {
        console.error('❌ Critical error in delete-user route:', error.message);

        if (error.message === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (error.message.includes('Access denied')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        return NextResponse.json({ error: 'Failed to process deletion' }, { status: 500 });
    }
}