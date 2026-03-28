// src/app/api/setup-company/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { verifySession, encrypt } from '@/lib/auth';
import { db } from '@/lib/drizzle';
import { users, companies, roles, userRoles } from '../../../../drizzle'; 
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // 1. Identify the new user via their temporary session
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, officeAddress, isHeadOffice, phoneNumber, region, area } = body;

    const result = await db.transaction(async (tx) => {
      
      // 2. Create the Company Record
      const [newCompany] = await tx.insert(companies).values({
        companyName,
        officeAddress,
        isHeadOffice,
        phoneNumber,
        region,
        area,
        adminUserId: session.userId.toString(), 
      }).returning();

      // 3. Update User: Set Org Role to 'Admin'
      const [updatedUser] = await tx.update(users).set({
        companyId: newCompany.id,
        role: 'Admin', // Highest privilege Org Role
        region,
        area,
        status: 'active',
        isDashboardUser: true,
      }).where(eq(users.id, session.userId)).returning();

      // 4. Link to 'Admin' Job Role: Sets ["READ", "WRITE", "UPDATE"]
      const adminJobRole = await tx
        .select()
        .from(roles)
        .where(eq(roles.jobRole, 'Admin'))
        .limit(1);
      
      let perms: string[] = [];
      if (adminJobRole[0]) {
        await tx.insert(userRoles).values({
          userId: session.userId,
          roleId: adminJobRole[0].id
        });
        perms = adminJobRole[0].grantedPerms;
      }

      return { newCompany, updatedUser, perms };
    });

    // 5. Re-issue JWT with the new Admin privileges
    const newSessionData = {
      userId: result.updatedUser.id,
      email: result.updatedUser.email,
      orgRole: 'Admin',
      jobRoles: ['Admin'],
      permissions: result.perms,
      companyId: result.newCompany.id,
    };

    const newToken = await encrypt(newSessionData);
    const cookieStore = await cookies();
    cookieStore.set('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return NextResponse.json({ 
      message: 'Company initialized with Admin privileges.',
      company: result.newCompany 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Setup Error:', error);
    return NextResponse.json({ error: 'Failed to setup company' }, { status: 500 });
  }
}