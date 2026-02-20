// src/app/dashboard/slmGeotracking/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { GeotrackingTabs } from './tabsLoader'; 
import { hasPermission, WorkOSRole } from '@/lib/permissions';
import { connection } from 'next/server';

export default function GeotrackingPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Geotracking Management Page
        </h2>
      </div>

      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <GeotrackingDynamicContent />
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

export async function GeotrackingDynamicContent() {
  await connection();
  const userRole = await getCurrentUserRole();
  const roleToCheck = userRole ?? 'junior-executive'; // Default to lowest role

 // --- PERMISSION CHECKS ---
  const canSeeGeotracking = hasPermission(roleToCheck, 'salesmanGeotracking.slmGeotracking');
  const canSeeLiveLocation = hasPermission(roleToCheck, 'salesmanGeotracking.salesmanLiveLocation');

  // If user has NEITHER, show access denied
  if (!canSeeGeotracking && !canSeeLiveLocation) {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh]">
            <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
            <p className="text-muted-foreground">You do not have permission to view Geotracking or Live Maps.</p>
        </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      
      <GeotrackingTabs 
        canSeeGeotracking={canSeeGeotracking}
        canSeeLiveLocation={canSeeLiveLocation}
      />
    </div>
  );
}