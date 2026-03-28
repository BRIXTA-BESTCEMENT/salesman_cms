// src/app/api/company/route.ts
import { NextResponse } from 'next/server';
import { connection } from 'next/server';
import { getCompanyInfo } from '@/lib/company-service';
import { verifySession } from '@/lib/auth';

export async function GET() {
  await connection();

  try {
    const session = await verifySession();

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyData = await getCompanyInfo(session.companyId);

    if (!companyData) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json(companyData);
  } catch (error: any) {
    console.error('Error fetching company info:', error);
    return NextResponse.json({ error: 'Failed to fetch company info' }, { status: 500 });
  }
}