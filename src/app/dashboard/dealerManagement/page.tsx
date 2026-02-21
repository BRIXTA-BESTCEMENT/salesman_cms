// src/app/dashboard/dealerManagement/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../../drizzle';
import { eq } from 'drizzle-orm';
import { DealerManagementTabs } from './tabsLoader';
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';

// 1. The Static Shell
export default function DealersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Dealers Management Page
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <DealersDynamicContent />
      </Suspense>
    </div>
  );
}

async function getCurrentUserRole(): Promise<WorkOSRole | null> {

  const claims = await getTokenClaims();
  if (!claims?.sub) {
    return null;
  }

  const result = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);
    
    const user = result[0];
    
    return (user?.role as WorkOSRole) ?? null;

}

// 2. The Dynamic Content
async function DealersDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive'; // Default to lowest role

  const canSeeAddAndListDealers = hasPermission(roleToCheck, 'dealerManagement.addAndListDealers');
  const canSeeListDealers = hasPermission(roleToCheck, 'dealerManagement.listDealers');
  const canSeeVerifyDealers = hasPermission(roleToCheck, 'dealerManagement.verifyDealers');
  const canSeeBrandMapping = hasPermission(roleToCheck, 'dealerManagement.dealerBrandMapping');
  const canSeeListVerifiedDealers = hasPermission(roleToCheck, 'dealerManagement.listVerifiedDealers');

  const canSeeAnything = canSeeAddAndListDealers || canSeeListDealers || canSeeVerifyDealers || canSeeBrandMapping || canSeeListVerifiedDealers;

  // Handle users who can't see anything
  if (!canSeeAnything) {
    return (
      <div className="mt-4">
        <h3 className="text-xl font-semibold tracking-tight text-red-600">Access Denied</h3>
        <p className="text-neutral-500">
          You do not have permission to view this section.
        </p>
      </div>
    );
  }

  // Render the CLIENT component and pass the server-side permissions as props
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 overflow-x-hidden">

      <DealerManagementTabs
        canSeeListDealers={canSeeListDealers}
        canSeeVerifyDealers={canSeeVerifyDealers}
        canSeeBrandMapping={canSeeBrandMapping}
        canSeeListVerifiedDealers={canSeeListVerifiedDealers}
      />
    </div>
  );
}