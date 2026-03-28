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

    // 1. Find user by Dashboard Login ID
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.dashboardLoginId, email))
      .limit(1);

    const user = userResult[0];

    // 2. IMMEDIATE SECURITY CHECK
    // We check existence and password BEFORE trying to fetch roles
    if (!user || !user.isDashboardUser || user.dashboardHashedPassword !== password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 3. FETCH ROLES & PERMISSIONS
    // Since we know the user is valid now, we fetch their assigned Job Roles and the associated CRUD permissions
    const userRolesResult = await db
      .select({
        jobRole: roles.jobRole,
        permissions: roles.grantedPerms 
      })
      .from(userRoles)
      .leftJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    // Map names and flatten all permission arrays into one unique list for the JWT
    const jobRoleNames = userRolesResult.map(r => r.jobRole).filter(Boolean) as string[];
    const allPerms = Array.from(
      new Set(userRolesResult.flatMap(r => r.permissions || []))
    );

    // 4. Update Status if needed
    if (user.status !== 'active') {
      await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    }

    // 5. Create the JWT payload
    const sessionData = {
      userId: user.id,
      email: user.email,
      orgRole: user.role,           // e.g., 'executive'
      jobRoles: jobRoleNames,        // e.g., ['Sales-Marketing', 'Technical-Sales']
      permissions: allPerms,         // e.g., ['READ', 'WRITE', 'UPDATE']
      companyId: user.companyId,
    };

    // 6. Encrypt and set cookie
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