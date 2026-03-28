import { NextRequest, NextResponse } from 'next/server';

const REFRESH_HTML = (returnTo: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Refreshing...</title>
</head>
<body>
  <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
    <div style="text-align: center;">
      <div style="margin-bottom: 20px;">🔄 Refreshing your session...</div>
      <div style="font-size: 14px; color: #666;">Please wait while we update your authentication.</div>
    </div>
  </div>
  
  <form id="logoutForm" method="POST" action="/account/logout" style="display: none;">
    <input type="hidden" name="returnTo" value="/login?returnTo=${encodeURIComponent(returnTo)}" />
  </form>
  
  <script>
    setTimeout(() => {
      document.getElementById('logoutForm').submit();
    }, 1000);
  </script>
</body>
</html>
`;

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/dashboard';
  console.log('🔄 GET /auth/refresh: Refreshing session, returnTo:', returnTo);
  
  const html = REFRESH_HTML(returnTo);
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// --- THIS IS THE FIX ---
// We add a POST handler that does the exact same thing as the GET handler.
// This catches the POST redirect from the layout.
export async function POST(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/dashboard';
  console.log('🔄 POST /auth/refresh: Refreshing session, returnTo:', returnTo);
  
  const html = REFRESH_HTML(returnTo);
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}