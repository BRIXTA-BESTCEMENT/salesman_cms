// src/app/dashboard/slmGeotracking/page.tsx
// --- NO 'use client' --- This is the Server Component.
export const dynamic = 'force-dynamic';
import { withAuth, getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { hasPermission, WorkOSRole } from '@/lib/permissions';

// Import the Tabs Component (Ensure you have this file created as discussed)
import { GeotrackingTabs } from './tabsLoader'; 

const allowedRoles = [
  'president', 'senior-general-manager', 'general-manager',
  'regional-sales-manager', 'area-sales-manager', 'senior-manager',
  'manager', 'assistant-manager', 'senior-executive'
];

export default async function GeotrackingPage() {
  const { user } = await withAuth({ ensureSignedIn: true });
  const claims = await getTokenClaims();

  if (!user) redirect('/login');

  const dbUser = await prisma.user.findUnique({
    where: { workosUserId: user.id },
  });

  const userRole = claims.role as WorkOSRole;

  // Basic Role Check
  if (!dbUser || !allowedRoles.includes(userRole)) {
    redirect('/dashboard');
  }

 // --- PERMISSION CHECKS ---
  const canSeeGeotracking = hasPermission(userRole, 'salesmanGeotracking.slmGeotracking');
  const canSeeLiveLocation = hasPermission(userRole, 'salesmanGeotracking.salesmanLiveLocation');

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
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Geo-Tracking & Live Map</h2>
      </div>
      
      {/* Pass the permissions to the client component */}
      <GeotrackingTabs 
        canSeeGeotracking={canSeeGeotracking}
        canSeeLiveLocation={canSeeLiveLocation}
      />
    </div>
  );
}