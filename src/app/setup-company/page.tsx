// src/app/setup-company/page.tsx
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SetupCompanyForm from './setupCompanyForm';

export default async function SetupCompanyPage() {
  const session = await verifySession();

  // If there's no session at all, they haven't even done basic signup
  if (!session) {
    redirect('/login'); 
  }

  // If they are already linked to a company, they shouldn't be here
  if (session.companyId) {
    redirect('/home');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <SetupCompanyForm />
    </div>
  );
}