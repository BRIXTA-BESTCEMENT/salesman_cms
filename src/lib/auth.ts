// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// In production, MUST use a strong, random 32+ character string in your .env
const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Session lasts 7 days
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    return null;
  }
}

export async function verifySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  if (!payload) return null;

  return {
    userId: payload.userId as number,
    companyId: payload.companyId as number,
    orgRole: payload.orgRole as string,
    permissions: (payload.permissions as string[]) || [], 
  };
}

// Simple helper function to use in routes
export function hasPermission(sessionPerms: string[], required: string): boolean {
  // Allow a "Admin" bypass 
  if (sessionPerms.includes('admin:*') || sessionPerms.includes('*')) return true;
  return sessionPerms.includes(required);
}