// src/app/auth/callback/route.ts
import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest } from 'next/server';

export const GET = async (request: NextRequest) => {
  // First, parse the request.url string into a URL object
  // This is crucial because request.url is typed as a string in your environment.
  const originalUrlObject = new URL(request.url);

  // --- Debugging logs ---
  // console.log('--- Auth Callback Debugging ---');
  // console.log('Original Request URL (string from NextRequest):', request.url); // The raw string
  // console.log('Parsed URL Object (toString()):', originalUrlObject.toString());
  // console.log('Parsed URL Object (origin):', originalUrlObject.origin);
  // console.log('Parsed URL Object (pathname):', originalUrlObject.pathname);
  // console.log('Parsed URL Object (search):', originalUrlObject.search);
  // console.log('process.env.WORKOS_REDIRECT_URI:', process.env.WORKOS_REDIRECT_URI);
  // console.log('process.env.NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  // console.log('Request Headers Host:', request.headers.get('host'));
  // console.log('Request Headers X-Forwarded-Host:', request.headers.get('x-forwarded-host'));
  // console.log('--- End Auth Callback Debugging ---');

  const publicHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https'; 

  const correctBaseUrl = `${protocol}://${publicHost}`;

  // Access searchParams from the *newly created URL object*
  const urlSearchParams = originalUrlObject.searchParams; 
  const queryString = urlSearchParams.toString(); 

  // Construct the full path with the correctly built query string.
  const correctedPathAndQuery = '/auth/callback' + (queryString ? '?' + queryString : '');

  // Create the corrected URL object that handleAuth should see
  const correctedUrlObject = new URL(correctedPathAndQuery, correctBaseUrl);

  const correctedRequest = new NextRequest(correctedUrlObject.toString(), {
    headers: request.headers,
    method: request.method,
  });

  console.log('Corrected Request URL toString():', correctedRequest.url.toString()); 

  return handleAuth({
    returnPathname: '/dashboard',
  })(correctedRequest);
};