// src/app/dashboard/reports/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { ReportsTabs } from './tabsLoader';
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';

export default function ReportsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Reports Management Page
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <ReportsDynamicContent />
      </Suspense>
    </div>
  );
}

async function getCurrentUserRole(): Promise<WorkOSRole | null> {
  
    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return null; // Not logged in
    }

    const result = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);
    
    const user = result[0];
    
    return (user?.role as WorkOSRole) ?? null;
  
}

// The page component is now an 'async' function
export async function ReportsDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive'; // Default to lowest role

  const canSeeDVR = hasPermission(roleToCheck, 'reports.dailyVisitReports');
  const canSeeTVR = hasPermission(roleToCheck, 'reports.technicalVisitReports');
  const canSeeSalesOrders = hasPermission(roleToCheck, 'reports.salesOrders');
  const canSeeCompetition = hasPermission(roleToCheck, 'reports.competitionReports');
  const canSeeDvrVpjp = hasPermission(roleToCheck, 'reports.dvrVpjp');
  const canSeeTvrVpjp = hasPermission(roleToCheck, 'reports.tvrVpjp');
  const canSeeSalesVdvr = hasPermission(roleToCheck, 'reports.salesVdvr');

  const canSeeAnyReport = canSeeDVR || canSeeTVR || canSeeSalesOrders || canSeeCompetition || canSeeDvrVpjp || canSeeTvrVpjp || canSeeSalesVdvr;

  // 3. Handle users who can't see anything
  if (!canSeeAnyReport) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <h2 className="text-3xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-neutral-500">
          You do not have permission to view this section.
        </p>
      </div>
    );
  }

  // 4. Render the page, passing permissions to the client component
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      
      <ReportsTabs
        canSeeDVR={canSeeDVR}
        canSeeTVR={canSeeTVR}
        canSeeSalesOrders={canSeeSalesOrders}
        canSeeCompetition={canSeeCompetition}
        canSeeDvrVpjp={canSeeDvrVpjp}
        canSeeTvrVpjp={canSeeTvrVpjp}
        canSeeSalesVdvr={canSeeSalesVdvr}
      />
    </div>
  );
}