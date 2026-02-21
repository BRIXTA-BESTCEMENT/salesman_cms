// src/app/dashboard/usersAndTeam/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
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

async function getAdminUser() {
  const claims = await getTokenClaims();
  if (!claims?.sub) {
    return null;
  }

  const result = await db
    .select({
      user: users,
      company: companies,
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.workosUserId, claims.sub))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  // Reconstruct the nested object shape that Prisma normally returns
  const dbUser = result[0].user;
  const dbCompany = result[0].company;

  return {
    ...dbUser,
    company: dbCompany,
  };
}

export async function UsersAndTeamDynamicContent() {
  await connection();
  const adminUser = await getAdminUser();
  const roleToCheck = (adminUser?.role as WorkOSRole) ?? 'junior-executive';

  const canSeeUsers = hasPermission(roleToCheck, 'usersAndTeam.userManagement');
  const canSeeTeamView = hasPermission(roleToCheck, 'usersAndTeam.teamOverview');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">

      <UsersAndTeamTabs
        adminUser={adminUser}
        canSeeUsers={canSeeUsers}
        canSeeTeamView={canSeeTeamView}
      />
    </div>
  );
}