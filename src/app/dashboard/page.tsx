// src/app/dashboard/page.tsx
import { Suspense } from 'react';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { users } from '../../../drizzle'; 
import { eq } from 'drizzle-orm';
import DashboardGraphs from './dashboardGraphs';
import SimpleWelcomePage from '@/app/dashboard/welcome/page';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';

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
  
  // Custom JWT Check
  const session = await verifySession();
  
  if (!session || !session.userId) {
    redirect('/login');
  }

  // Look up user by your local integer ID now, instead of WorkOS string ID
  const result = await db
    .select({ role: users.role, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const dbUser = result[0];
  
  if (!dbUser) {
    redirect('/login');
  }

  const userRole = dbUser.role || '';

  // CONDITIONAL RENDER
  if (allowedNonAdminRoles.includes(userRole)) {
    return <SimpleWelcomePage firstName={dbUser.firstName || 'Team Member'} />;
  }

  console.log('DashboardPage: Rendering DashboardGraphs...');
  
  return <DashboardGraphs />;
}