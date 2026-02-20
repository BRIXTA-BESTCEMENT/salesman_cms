// src/app/api/me/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Schema for validating returned user info
const currentUserSchema = z.object({
  id: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  role: z.string(),
  companyId: z.number().nullable(),
});

export async function GET() {
  try {
    const claims = await getTokenClaims();

    // 1. Authentication Check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch current user from DB
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        companyId: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Validate response data
    const validatedUser = currentUserSchema.parse(currentUser);

    // 4. Return the validated user object
    return NextResponse.json(validatedUser, { status: 200 });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current user', details: (error as Error).message },
      { status: 500 }
    );
  }
}
