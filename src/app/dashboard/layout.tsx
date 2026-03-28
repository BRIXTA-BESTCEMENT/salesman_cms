// src/app/dashboard/layout.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from "next";
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../drizzle';
import { eq } from 'drizzle-orm';
import DashboardShell from '@/app/dashboard/dashboardShell';
import { connection } from 'next/server';
import { verifySession } from '@/lib/auth'; // <-- IMPORT CUSTOM AUTH

const allowedAdminRoles = [
  'president',
  'senior-general-manager',
  'general-manager',
  'regional-sales-manager',
  'area-sales-manager',
  'senior-manager',
  'manager',
  'assistant-manager',
  'Admin', // Included your new Super Admin role
];

const allowedNonAdminRoles = [
  'senior-executive',
  'executive',
  'junior-executive',
];

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
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
    </Suspense>
  );
}

// 2. DYNAMIC LAYOUT: Handles custom JWT session and database checks
export async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  
  // 1. Verify custom session
  const session = await verifySession();

  if (!session || !session.userId) {
    redirect('/login');
  }

  // 2. Fetch User directly from DB using their local integer ID
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      companyId: companies.id,
      companyName: companies.companyName,
      adminUserId: companies.adminUserId,
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, session.userId))
    .limit(1);

  const dbUser = result[0];

  // If the user doesn't exist in the database, log them out.
  if (!dbUser) {
    redirect('/api/auth/logout');
  }

  // Check for company access
  if (!dbUser.companyId) {
    console.error('User has no company access');
    redirect('/setup-company');
  }

  const finalRole = dbUser.role;
  const permissions: string[] = []; // We will map RBAC array here later
  console.log('🎯 Final role being used:', finalRole);

  // SAFETY CHECK: If they have NO valid role at all, block them.
  if (!allowedAdminRoles.includes(finalRole) && !allowedNonAdminRoles.includes(finalRole)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">Your role ({finalRole}) does not have dashboard access.</p>
          <a 
             href="/api/auth/logout" 
             className="inline-block px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 font-medium transition-colors"
          >
            Sign Out
          </a>
        </div>
      </div>
    );
  }

  // Format data to match DashboardShellProps exactly
  const mappedUser = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    role: dbUser.role,
    company: {
      id: dbUser.companyId!,
      companyName: dbUser.companyName!,
      adminUserId: dbUser.adminUserId?.toString() || dbUser.id.toString(),
    }
  };

  return (
    <DashboardShell
      user={mappedUser}
      company={mappedUser.company}
      role={finalRole}
      permissions={permissions}
    >
      {children}
    </DashboardShell>
  );
}