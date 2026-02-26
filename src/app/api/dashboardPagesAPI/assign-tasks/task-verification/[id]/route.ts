// src/app/api/dashboardPagesAPI/assign-tasks/task-verification/[id]/route.ts
import 'server-only';
import { NextResponse, NextRequest } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, dailyTasks, dealers } from '../../../../../../../drizzle'; 
import { eq } from 'drizzle-orm';
import { insertDailyTaskSchema } from '../../../../../../../drizzle/zodSchemas'; 

const allowedRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'regional-sales-manager', 'senior-manager', 'manager', 'assistant-manager',
];

async function verifyTask(taskId: string, currentUserCompanyId: number) {
    if (!taskId) throw new Error("Task ID is required.");
    
    const results = await db
        .select({ task: dailyTasks, user: { companyId: users.companyId } })
        .from(dailyTasks)
        .leftJoin(users, eq(dailyTasks.userId, users.id))
        .where(eq(dailyTasks.id, taskId))
        .limit(1);

    const taskToUpdate = results[0];

    if (!taskToUpdate) return { error: 'Task not found', status: 404 };
    if (!taskToUpdate.user || taskToUpdate.user.companyId !== currentUserCompanyId) {
        return { error: 'Forbidden: Cannot verify a Task from another company', status: 403 };
    }

    return { taskToUpdate: taskToUpdate.task };
}

// PUT: Update Status (Approve/Reject)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: taskId } = await params;
        if (!taskId) return NextResponse.json({ error: 'Missing Task ID' }, { status: 400 });

        const claims = await getTokenClaims();
        if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserResult = await db.select({ id: users.id, role: users.role, companyId: users.companyId }).from(users).where(eq(users.workosUserId, claims.sub)).limit(1);
        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const verificationResult = await verifyTask(taskId, currentUser.companyId);
        if (verificationResult.error) return NextResponse.json({ error: verificationResult.error }, { status: verificationResult.status });

        const body = await request.json();
        const { status } = body; // expecting "VERIFIED" or "REJECTED"

        if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

        const updatedTaskResult = await db
            .update(dailyTasks)
            .set({ status: status as string })
            .where(eq(dailyTasks.id, taskId))
            .returning();


        return NextResponse.json({ message: `Task status updated to ${status}`, task: updatedTaskResult[0] }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update Task status', details: (error as Error).message }, { status: 500 });
    }
}

// PATCH: Modify Task and Set to Verified
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: taskId } = await params;
        if (!taskId) return NextResponse.json({ error: 'Missing Task ID' }, { status: 400 });

        const claims = await getTokenClaims();
        if (!claims || !claims.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const currentUserResult = await db.select({ id: users.id, role: users.role, companyId: users.companyId }).from(users).where(eq(users.workosUserId, claims.sub)).limit(1);
        const currentUser = currentUserResult[0];

        if (!currentUser || !allowedRoles.includes(currentUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const verify = await verifyTask(taskId, currentUser.companyId);
        if (verify.error) return NextResponse.json({ error: verify.error }, { status: verify.status });

        const taskModificationSchema = insertDailyTaskSchema.partial().loose();
        const v = taskModificationSchema.safeParse(await request.json());
        
        if (!v.success) return NextResponse.json({ error: 'Invalid Task modification data.', details: v.error.issues }, { status: 400 });

        if (v.data.dealerId) {
            const dealerExists = await db.select({ id: dealers.id }).from(dealers).where(eq(dealers.id, v.data.dealerId)).limit(1);
            if (!dealerExists[0]) return NextResponse.json({ error: 'Invalid dealerId' }, { status: 400 });
        }

        const updatedTaskResult = await db
            .update(dailyTasks)
            .set({
                ...v.data,
                taskDate: v.data.taskDate ? new Date(v.data.taskDate).toISOString() : undefined,
                status: 'VERIFIED',
            })
            .where(eq(dailyTasks.id, taskId))
            .returning();

        return NextResponse.json({ message: `Task modified and VERIFIED successfully`, task: updatedTaskResult[0] }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to modify Task', details: (error as Error).message }, { status: 500 });
    }
}