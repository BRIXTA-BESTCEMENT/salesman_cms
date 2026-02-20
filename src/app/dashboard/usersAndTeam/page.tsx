// src/app/dashboard/usersAndTeam/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { UsersAndTeamTabs } from './tabsLoader'; 
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';

export default function UsersAndTeamPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Users & Team Management Page
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <UsersAndTeamDynamicContent />
      </Suspense>
    </div>
  );
}

async function getCurrentUserRole(): Promise<WorkOSRole | null> {

    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true },
    });
    
    return (user?.role as WorkOSRole) ?? null;

}

export async function UsersAndTeamDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive'; 

  const canSeeUsers = hasPermission(roleToCheck, 'usersAndTeam.userManagement');
  const canSeeTeamView = hasPermission(roleToCheck, 'usersAndTeam.teamOverview');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      
      <UsersAndTeamTabs 
        adminUser={userRole}
        canSeeUsers={canSeeUsers}
        canSeeTeamView={canSeeTeamView}
      />
    </div>
  );
}