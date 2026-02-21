// src/app/api/auth/magic-auth/verify/route.ts
import { WorkOS } from '@workos-inc/node';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users } from '../../../../../drizzle'; 
import { eq, and } from 'drizzle-orm';

// --- START: IP UTILITY ---
function getIpAddress(request: NextRequest): string | undefined {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return undefined;
}
// --- END: IP UTILITY ---

export const POST = async (request: NextRequest) => {
    try {
        // --- Define the required constant locally ---
        const WORKOS_SESSION_COOKIE_NAME = 'wos-session';

        // Initialize the WorkOS client.
        if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID || !process.env.WORKOS_COOKIE_PASSWORD) { // <-- ADDED COOKIE PASSWORD CHECK
            throw new Error('WorkOS environment variables are not set');
        }
        const workos = new WorkOS(process.env.WORKOS_API_KEY);
        const CLIENT_ID = process.env.WORKOS_CLIENT_ID;
        const COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;

        const body = await request.json();
        const { email, code, invitationToken } = body;

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and 6-digit code are required.' }, { status: 400 });
        }
        if (typeof code !== 'string') {
            return NextResponse.json({ error: 'Code must be a string.' }, { status: 400 });
        }

        const ipAddress = getIpAddress(request);
        const userAgent = request.headers.get('user-agent') ?? undefined;

        console.log('🔄 Magic Auth: Attempting code verification...');

        // 1. Authenticate the user with the Magic Auth code (Code validation/Login attempt)
        //    --- THIS IS THE FIX ---
        //    We are asking for the session AND providing the cookie password.
        const { user, sealedSession } = await workos.userManagement.authenticateWithMagicAuth({
            clientId: CLIENT_ID,
            code: code,
            email: email,
            session: {
                sealSession: true,
                cookiePassword: COOKIE_PASSWORD
            },
            // DO NOT include invitationToken here, as we know this fails.
            ipAddress: ipAddress,
            userAgent: userAgent,
        });

        if (sealedSession) {
            console.log(`User authenticated via Magic Auth: ${user!.email}. Session cookie set.`);

            // 2. Handle Invitation Acceptance (if token exists)
            if (user && invitationToken) {
                console.log('Invitation token detected. Attempting to accept invitation on WorkOS...');
                try {
                    await workos.userManagement.acceptInvitation(invitationToken);
                    console.log(`WorkOS Invitation accepted and user provisioned to org.`);
                } catch (acceptError: any) {
                    if (acceptError.code === 'entity_not_found') {
                        console.warn('Invitation already accepted or expired on WorkOS. Proceeding.');
                    } else {
                        console.error('Failed to explicitly accept WorkOS invitation:', acceptError);
                    }
                }

                // 3. Update Local Database
                const pendingUserResult = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(
                        and(
                            eq(users.email, user.email),
                            eq(users.status, 'pending'),
                            eq(users.inviteToken, invitationToken)
                        )
                    )
                    .limit(1);

                const pendingUser = pendingUserResult[0];

                if (pendingUser) {
                    await db
                        .update(users)
                        .set({
                            workosUserId: user.id,
                            status: 'active',
                            inviteToken: null,
                        })
                        .where(eq(users.id, pendingUser.id));
                        
                    console.log(`Successfully accepted invitation for local user ID ${pendingUser.id} and linked WorkOS ID ${user.id}`);
                }
            }

            // 4. Return Response with Cookie
            const response = NextResponse.json({ success: true, redirectUrl: '/dashboard' });

            // FIX: Dynamic Secure Flag
            // If we are on HTTPS (Render), this is 'https'. If on HTTP (IP), it's 'http'.
            const protocol = request.headers.get('x-forwarded-proto') || 'http';
            const isSecure = protocol === 'https';

            response.cookies.set(WORKOS_SESSION_COOKIE_NAME, sealedSession, {
                path: '/',
                maxAge: 7 * 24 * 60 * 60,
                httpOnly: true,
                // Only set Secure if we are actually on HTTPS
                secure: isSecure,
                sameSite: 'lax',
            });

            return response;
        } else {
            console.error('Authentication Failed: No sealedSession returned from WorkOS.');
            return NextResponse.json({
                error: 'Authentication failed. Please try again.'
            }, { status: 401 });
        }

    } catch (error: any) {
        console.error('Magic Auth Verify Handler Failed:', error);

        // Handle WorkOS specific authentication failure errors
        if (error.response?.data?.error === 'invalid_grant' || error.status === 401) {
            return NextResponse.json({
                error: 'Invalid code or email. Please check your inbox and try again.'
            }, { status: 401 });
        }
        if (error.code === 'not_authorized') {
            return NextResponse.json({ error: 'Authentication is not authorized for this user.' }, { status: 403 });
        }
        if (error.code === 'entity_not_found') {
            return NextResponse.json({
                error: 'Authentication failed. Your invitation token may be invalid.',
            }, { status: 401 });
        }

        return NextResponse.json({
            error: 'An unexpected server error occurred during login.'
        }, { status: 500 });
    }
};

// Disable all other HTTP methods
export const GET = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
export const PUT = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
export const DELETE = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });