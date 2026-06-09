// src/proxy.ts -- previously middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from './lib/auth';

// Define your list of allowed origins for CORS.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3000/auth/callback',
  'https://salesmancms-dashboard.onrender.com',
  'https://salesmancms-dashboard.onrender.com/auth/callback',
  'http://122.176.219.242',
  'http://122.176.219.242/auth/callback',
  'http://122.176.219.242:55002',
  'http://122.176.219.242:55002/auth/callback',
  'http://salesforce.bestcement.co.in',
  'http://salesforce.bestcement.co.in/auth/callback',
  'https://salesforce.bestcement.co.in',
  'https://salesforce.bestcement.co.in/auth/callback',
  'http://localhost:8000',
  'https://brixta.site',
];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  

  const token = request.cookies.get('auth_token')?.value;

  const isProtectedRoutes = pathname.startsWith('/dashboard') || 
                            pathname.startsWith('/home') ||
                            pathname.startsWith('/account');  

  let response = NextResponse.next();

  // 1. Actually VERIFY the token payload
  let isValidSession = false;
  if (token) {
    const payload = await decrypt(token);
    if (payload) isValidSession = true;
  }

  // --- ROUTING for AUTHENTICATED & UNAUTHENTICATED paths ----
  if (!token && isProtectedRoutes) {
    response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
  else if (token && (pathname === '/login' || pathname === '/')){
    response = NextResponse.redirect(new URL('/home', request.url));
    return response;
  }

  // --- CORS LOGIC ---
  const origin = request.headers.get('Origin');

  // Check if the request's origin is in our allowed list.
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  // Set other necessary CORS headers.
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}

// Your existing matcher configuration.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.webp|.*\\.png|.*\\.svg).*)',
  ],
};

