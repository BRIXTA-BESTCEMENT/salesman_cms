// src/app/dashboard/page.tsx
import { Suspense } from 'react';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users } from '../../../drizzle'; 
import { eq } from 'drizzle-orm';
import DashboardGraphs from './dashboardGraphs';
import SimpleWelcomePage from '@/app/dashboard/welcome/page';
import { connection } from 'next/server';

const allowedNonAdminRoles = [
  'senior-executive',
  'executive',
  'junior-executive',
];

// 1. The Static Shell 
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

// 2. The Dynamic Content (Runs at request-time)
async function DashboardContent() {
  await connection();
  const { user } = await withAuth();
  
  if (!user) return null; 

  const result = await db
    .select({ role: users.role, firstName: users.firstName })
    .from(users)
    .where(eq(users.workosUserId, user.id))
    .limit(1);

  const dbUser = result[0];
  const userRole = dbUser?.role || '';

  // CONDITIONAL RENDER
  if (allowedNonAdminRoles.includes(userRole)) {
    return <SimpleWelcomePage firstName={dbUser?.firstName || 'Team Member'} />;
  }

  console.log('DashboardPage: Rendering DashboardGraphs...');
  
  return <DashboardGraphs />;
}