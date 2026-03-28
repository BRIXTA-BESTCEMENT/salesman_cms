// src/app/dashboard/assignTasks/page.tsx
import { Suspense } from 'react';
import { db } from '@/lib/drizzle';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { AssignTasksTabs } from './tabsLoader';
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';
import { verifySession } from '@/lib/auth';

export default function AssignTasksPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Sales PJP Management
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <AssignTasksDynamicContent />
      </Suspense>
    </div>
  );
}

async function getCurrentUserRole(): Promise<WorkOSRole | null> {
  
  const session = await verifySession();
  if (!session || !session.userId) {
    return null;
  }

  const result = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = result[0];

  return (user?.role as WorkOSRole) ?? null;
}

export async function AssignTasksDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive';

  const canSeeTasksList = hasPermission(roleToCheck, 'assignTasks.tasksList');
  const canSeeVerifyTasks = hasPermission(roleToCheck, 'assignTasks.verifyTasks');

  if (!canSeeTasksList && !canSeeVerifyTasks) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <h2 className="text-3xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-neutral-500">
          You do not have permission to view this section.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-0">
      <AssignTasksTabs
        canSeeTasksList={canSeeTasksList}
        canSeeVerifyTasks={canSeeVerifyTasks}
      />
    </div>
  );
}