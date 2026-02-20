// src/app/dashboard/layout.tsx
import { Suspense } from 'react';
import { withAuth, getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import type { Metadata } from "next";
import prisma from '@/lib/prisma';
import DashboardShell from '@/app/dashboard/dashboardShell';
import { connection } from 'next/server';

const allowedAdminRoles = [
  'president',
  'senior-general-manager',
  'general-manager',
  'regional-sales-manager',
  'area-sales-manager',
  'senior-manager',
  'manager',
  'assistant-manager',
  //'senior-executive', 
  //'executive',
  //'junior-executive',
];
const allowedNonAdminRoles = [
  'senior-executive',
  'executive',
  'junior-executive',
];
// Pages that non-admin roles are allowed to access
const nonAdminAllowedPages = [
  '/dashboard',
  '/dashboard/reports',
  '/dashboard/dealerManagement',
  '/dashboard/permanentJourneyPlan',
  '/dashboard/salesmanAttendance',
  '/dashboard/scoresAndRatings',
];

async function refreshUserJWTIfNeeded(user: any, claims: any) {
  if (!claims?.org_id) {
    console.log('⚠️ JWT missing organization data, checking database...');

    const dbUser = await prisma.user.findUnique({
      where: { workosUserId: user.id },
      include: { company: true }
    });

    // We now check if the user's role is in the list of allowed admin roles
    if (dbUser) {
      console.log(`🔄 User ${dbUser.email || user.id} detected with incomplete JWT - forcing refresh.`);
      return { needsRefresh: true };
    }
  }
  return { needsRefresh: false };
}

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.ico",
  },
};

// 1. STATIC SHELL: This guarantees the build won't fail due to runtime data
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This loading screen shows up for a fraction of a second while auth resolves
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </Suspense>
  );
}

// 2. DYNAMIC LAYOUT: Handles all the cookies, auth, and database checks
export async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { user } = await withAuth();
  const claims = await getTokenClaims();

  if (!user) {
    redirect('/login');
  }

  // Ensure the user is in the local database before proceeding.
  let dbUser = await prisma.user.findUnique({
    where: { workosUserId: user.id },
    include: { company: true }
  });

  // If the user doesn't exist in the database by workosUserId,
  // try to find them by email and link their account.
  if (!dbUser) {
    const userByEmail = await prisma.user.findFirst({
      where: { email: user.email },
    });
    if (userByEmail) {
      console.log(`🔗 Linking existing user account ${userByEmail.email} with WorkOS ID ${user.id}`);
      dbUser = await prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          workosUserId: user.id,
          status: 'active',
          inviteToken: null,
          role: claims?.role as string || userByEmail.role,
        },
        include: { company: true }
      });
    } else {
      // If they are not in the DB at all, this is a critical issue.
      console.error('❌ User exists in WorkOS but not in the local database.');
      redirect('/setup-company');
    }
  }

  // All subsequent logic now assumes `dbUser` is valid.
  const workosRole = claims?.role as string | undefined;
  const permissions = (claims?.permissions as string[]) || [];

  const refreshCheck = await refreshUserJWTIfNeeded(user, claims);
  if (refreshCheck.needsRefresh) {
    redirect('/auth/refresh?returnTo=/dashboard');
  }

  // Check if the user's role is out of sync and update it
  if (workosRole && dbUser.role !== workosRole) {
    console.log(`🔄 Updating user role from ${dbUser.role} to ${workosRole}`);
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: workosRole },
      include: { company: true }
    });
  }

  // Check for company access
  const company = dbUser.company;
  if (!company) {
    console.error('User has no company access');
    redirect('/setup-company');
  }

  const finalRole = dbUser.role;
  console.log('🎯 Final role being used:', finalRole);

  // --- CORRECTED REDIRECT LOGIC ---
  // const urlPath = process.env.NEXT_PUBLIC_APP_URL
  // const headersList = await headers();
  // const currentUrl = headersList.get('x-url') || '/';
  // const url = new URL(currentUrl, urlPath);
  // const isWelcomePage = url.pathname === '/dashboard/welcome';
  // const hasNameParam = url.searchParams.has('name');

  // if (allowedNonAdminRoles.includes(finalRole)) {
  //   const isAllowedPage = nonAdminAllowedPages.includes(url.pathname);

  //   if (!isAllowedPage && !(isWelcomePage && hasNameParam)) {
  //     const name = dbUser.firstName || dbUser.email;
  //     redirect(`/dashboard/welcome?name=${name}&error=unauthorized`);
  //   }
  // }

  // NEW: Check if user is an Executive (Non-Admin)
  // We show them the Welcome View to prevent 403 errors from dashboard widgets
  // if (allowedNonAdminRoles.includes(finalRole)) {
  //   return (
  //     <DashboardShell
  //       user={dbUser}
  //       company={company}
  //       workosRole={finalRole}
  //       permissions={permissions}
  //     >
  //       {/* We ignore the passed 'children' and render WelcomeView instead */}
  //       <SimpleWelcomePage firstName={dbUser.firstName || 'Team Member'} />
  //     </DashboardShell>
  //   );
  // }

  // SAFETY CHECK: If they have NO valid role at all, block them.
  // (But if they are an Executive, we let them pass so they can see specific pages)
  if (!allowedAdminRoles.includes(finalRole) && !allowedNonAdminRoles.includes(finalRole)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">Your role ({finalRole}) does not have dashboard access.</p>
          <form action="/account/logout" method="POST">
            <button type="submit" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 font-medium transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      user={dbUser}
      company={company}
      workosRole={finalRole}
      permissions={permissions}
    >
      {children}
    </DashboardShell>
  );
}