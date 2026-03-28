// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, roles, userRoles } from '../../../../../drizzle';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // 1. Find user by Dashboard Login ID (which is their email)
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.dashboardLoginId, email))
      .limit(1);

    const user = userResult[0];

    const userRolesResult = await db
      .select({
        jobRole: roles.jobRole,
        permissions: roles.grantedPerms
      })
      .from(userRoles)
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const jobRoleNames = userRolesResult.map(r => r.jobRole);
    const allPermissions = Array.from(new Set(userRolesResult.flatMap(r => r.permissions)));

    // 2. Verify Access & Password (Plain text comparison for now)
    if (!user || !user.isDashboardUser || user.dashboardHashedPassword !== password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'active') {
      // Automatically activate them if they were pending
      await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    }

    // 3. Create the JWT payload
    const sessionData = {
      userId: user.id,
      email: user.email,
      orgRole: user.role,           // e.g., 'executive'
      jobRoles: jobRoleNames,        // e.g., ['Sales-Marketing', 'Technical-Sales']
      permissions: allPermissions,   // Combined array of all granted permissions
      companyId: user.companyId,
    };

    // 4. Encrypt and set cookie
    const token = await encrypt(sessionData);
    const cookieStore = await cookies();

    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ message: 'Login successful', redirect: '/home' }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}