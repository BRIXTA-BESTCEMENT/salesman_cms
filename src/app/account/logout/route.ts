// src/app/account/logout/route.ts
import { signOut } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

// Handle GET requests (direct link access)
export async function GET() {
  await signOut();
  redirect('/');
}

// Handle POST requests (form submissions)
export async function POST() {
  await signOut();
  redirect('/');
}