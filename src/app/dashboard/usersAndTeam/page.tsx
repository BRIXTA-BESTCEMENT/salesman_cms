// src/app/dashboard/usersAndTeam/page.tsx
// --- NO 'use client' --- This is the Server Component.
export const dynamic = 'force-dynamic';
import { withAuth, getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { hasPermission, WorkOSRole } from '@/lib/permissions';

// We will rename this component in Step 3
import { UsersAndTeamTabs } from './tabsLoader'; 

const allowedAdminRoles = [
    'president', 'senior-general-manager', 'general-manager',
    'regional-sales-manager', 'area-sales-manager', 'senior-manager',
    'manager', 'assistant-manager',
];

export default async function UsersAndTeamPage() {
  // 1. Auth & Admin User Fetch (From old Users page)
  const { user } = await withAuth({ ensureSignedIn: true });
  const claims = await getTokenClaims();

  if (!user) redirect('/login');

  const adminUser = await prisma.user.findUnique({
    where: { workosUserId: user.id },
    include: { company: true }
  });

  const userRole = claims.role as WorkOSRole;
  
  // Security Check
  if (!adminUser || !allowedAdminRoles.includes(userRole)) {
    redirect('/dashboard');
  }

  // 2. Permission Checks (From old Team Overview page)
  const checkRole = userRole || 'junior-executive';
  const canSeeUsers = hasPermission(checkRole, 'usersAndTeam.userManagement');
  const canSeeTeamView = hasPermission(checkRole, 'usersAndTeam.teamOverview');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Users & Team</h2>
      </div>
      
      {/* Pass adminUser to the tabs */}
      <UsersAndTeamTabs 
        adminUser={adminUser}
        canSeeUsers={canSeeUsers}
        canSeeTeamView={canSeeTeamView}
      />
    </div>
  );
}