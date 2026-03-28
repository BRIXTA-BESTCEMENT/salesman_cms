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
  const session = cookieStore.get('auth_token')?.value;

  if (!session) return null;

  const payload = await decrypt(session);
  if (!payload) return null;

  return payload as {
    companyId: number;
    userId: number;
    email: string;
    orgRole: string;
    jobRoles: string[];
    permissions: string[];
  };
}