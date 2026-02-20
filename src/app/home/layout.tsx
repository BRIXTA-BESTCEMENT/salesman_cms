// src/app/home/layout.tsx
import { Suspense } from 'react';
import { withAuth, getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import prisma from '@/lib/prisma';
import HomeShell from '@/app/home/homeShell';
import type { Metadata } from "next";

/**
 * Checks if the user's JWT is missing essential organization data and needs to be refreshed.
 * This is based on the logic from the dashboard layout.
 */
async function refreshUserJWTIfNeeded(user: any, claims: any) {
  // If org_id is missing from the claims, it suggests the JWT is incomplete.
  if (!claims?.org_id) {
    console.log('⚠️ JWT missing organization data, checking database...');

    // A simple existence check to confirm the user is known in the DB
    const dbUser = await prisma.user.findUnique({
      where: { workosUserId: user.id },
    });

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

// 1. STATIC SHELL: Allows Next.js Cache Components to prerender successfully
export default function CemTemChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthenticatedHomeLayout>{children}</AuthenticatedHomeLayout>
    </Suspense>
  );
}

export async function AuthenticatedHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  
  const { user } = await withAuth();
  const claims = await getTokenClaims();

  // 1. Authentication Check
  if (!user) {
    redirect('/login');
  }

  // 2. Ensure the user is in the local database.
  let dbUser = await prisma.user.findUnique({
    where: { workosUserId: user.id },
    include: { company: true }
  });

  // 3. Account Linking Logic (Check by email if workosUserId is missing)
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
      // User is authenticated via WorkOS but not found in DB. Critical issue.
      console.error('❌ User exists in WorkOS but not in the local database. Redirecting to setup.');
      redirect('/setup-company');
    }
  }

  // 4. JWT Refresh Check
  const refreshCheck = await refreshUserJWTIfNeeded(user, claims);
  if (refreshCheck.needsRefresh) {
    // Redirect back to this chat page after a successful refresh
    redirect('/auth/refresh?returnTo=/home');
  }

  // 5. Role Synchronization Check
  const workosRole = claims?.role as string | undefined;
  if (workosRole && dbUser.role !== workosRole) {
    console.log(`🔄 Updating user role from ${dbUser.role} to ${workosRole}`);
    dbUser = await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: workosRole },
      include: { company: true }
    });
  }

  // 6. Company Access Check
  const company = dbUser.company;
  if (!company) {
    console.error('User has no company access. Redirecting to setup.');
    redirect('/setup-company');
  }

  const finalRole = dbUser.role || 'senior-executive';
  const permissions = (claims?.permissions as string[]) || [];

  // No complex role-based page restriction is applied here, as this page is assumed to be an essential utility.

  return (
    <HomeShell
      user={dbUser}
      company={company}
      workosRole={finalRole}
      permissions={permissions}
    >
      {children}
    </HomeShell>
  );
}
