// src/app/page.tsx
import { Suspense } from 'react';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import SignedOutHomePage from '@/app/home/signedOutHomePage'; 
import { connection } from 'next/server';

// 1. This is the Static Shell. Next.js will prerender this instantly.
export default function LandingPage() {
  return (
    // The fallback is what the user sees for a split second while auth is checked
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthBoundary />
    </Suspense>
  );
}

// 2. This is the Dynamic Component. It runs at request-time.
async function AuthBoundary() {
  await connection();
  const claims = await getTokenClaims();

  // If the user is signed in, render the signed-in page.
  if (claims && claims.sub) {
    redirect('/dashboard'); // Redirect to the security gate
  }

  // If the user is not signed in, render the signed-out page.
  return <SignedOutHomePage />;
}