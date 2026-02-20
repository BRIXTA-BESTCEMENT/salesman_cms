// src/app/setup-company/page.tsx
import { Suspense } from 'react';
import { connection } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import SetupCompanyForm from './setupCompanyForm';

// 1. The Static Shell 
export default function SetupCompanyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
        <SetupCompanyDynamicContent />
      </Suspense>
    </div>
  );
}

// 2. The Dynamic Content (Runs securely at request time)
async function SetupCompanyDynamicContent() {
  await connection(); 
  
  const { user } = await withAuth({ ensureSignedIn: true });

  if (!user) {
    redirect('/login');
  }
  
  console.log('👤 Creating organization membership WITH admin role...');

  return <SetupCompanyForm />;
}