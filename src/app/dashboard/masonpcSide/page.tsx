// src/app/dashboard/masonpcSide/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { MasonPcTabs } from './tabsLoader';
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';

export default function MasonPcPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Mason-PC Management Page
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <MasonPcDynamicContent />
      </Suspense>
    </div>
  );
}

async function getCurrentUserRole(): Promise<WorkOSRole | null> {
  
    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return null; // Not logged in
    }

    const user = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { role: true },
    });
    
    return (user?.role as WorkOSRole) ?? null;
  
}

// The page component is now an 'async' function
export async function MasonPcDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive'; // Default to lowest role

  // Assumes permission strings match this 'masonpcSide.tabName' format
  const canSeeMasonPc = hasPermission(roleToCheck, 'masonpcSide.masonpc');
  const canSeeTsoMeetings = hasPermission(roleToCheck, 'masonpcSide.tsoMeetings');
  const canSeeSchemesOffers = hasPermission(roleToCheck, 'masonpcSide.schemesOffers');
  const canSeeMasonOnSchemes = hasPermission(roleToCheck, 'masonpcSide.masonOnSchemes');
  const canSeeMasonOnMeetings = hasPermission(roleToCheck, 'masonpcSide.masonOnMeetings');
  const canSeeBagsLift = hasPermission(roleToCheck, 'masonpcSide.bagsLift');
  const canSeePointsLedger = hasPermission(roleToCheck, 'masonpcSide.pointsLedger');
  const canSeeRewardsRedemption = hasPermission(roleToCheck, 'masonpcSide.rewardsRedemption');

  // Check if the user can see any of the tabs
  const canSeeAnything = canSeeMasonPc || canSeeTsoMeetings || canSeeSchemesOffers || canSeeMasonOnSchemes || canSeeMasonOnMeetings || canSeeBagsLift || canSeePointsLedger || canSeeRewardsRedemption;

  // 3. Handle users who can't see anything
  if (!canSeeAnything) {
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
      
      <MasonPcTabs
        canSeeMasonPc={canSeeMasonPc}
        canSeeTsoMeetings={canSeeTsoMeetings}
        canSeeSchemesOffers={canSeeSchemesOffers}
        canSeeMasonOnSchemes={canSeeMasonOnSchemes}
        canSeeMasonOnMeetings={canSeeMasonOnMeetings}
        canSeeBagsLift={canSeeBagsLift}
        canSeePointsLedger={canSeePointsLedger}
        canSeeRewardsRedemption={canSeeRewardsRedemption}
      />
    </div>
  );
}