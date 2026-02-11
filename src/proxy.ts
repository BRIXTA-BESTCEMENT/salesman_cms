// src/proxy.ts -- previously middleware.ts
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

// Define your list of allowed origins for CORS.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3000/auth/callback',
  'https://salesmancms-dashboard.onrender.com',
  'https://salesmancms-dashboard.onrender.com/auth/callback',
  'http://13.235.130.234',
  'http://13.235.130.234/auth/callback',
  'http://salesforce.bestcement.co.in',
  'http://salesforce.bestcement.co.in/auth/callback',
];

// The main middleware function that combines AuthKit and CORS logic.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // 1) Bypass for trusted internal hops FIRST
  //  if (request.headers.get('x-internal-request') === '1') {
  //    return NextResponse.next();
  //  }
  // First, run the AuthKit middleware, correctly passing both the request and event.
  const authkitResponse = await authkitMiddleware({
    middlewareAuth: {
      enabled: true,
      unauthenticatedPaths: [
        '/',
        '/login',
        '/login/magicAuth',
        '/auth-invite',
        '/auth/callback',
        '/auth/magic-auth',
        '/auth/magic-auth/verify',
      ],
    },
  })(request, event);

  // We must first check if the response from AuthKit is a valid NextResponse object
  // before attempting to modify its headers.
  if (authkitResponse instanceof NextResponse) {
    // Get the 'Origin' header from the incoming request.
    const origin = request.headers.get('Origin');

    // Check if the request's origin is in our allowed list.
    if (origin && allowedOrigins.includes(origin)) {
      // If the origin is allowed, set the CORS header on the response returned by AuthKit.
      authkitResponse.headers.set('Access-Control-Allow-Origin', origin);
    }

    // Set other necessary CORS headers.
    authkitResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    authkitResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Return the (potentially modified) response.
  return authkitResponse;
}

// Your existing matcher configuration.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.webp|.*\\.png|.*\\.svg).*)',
  ],
};

