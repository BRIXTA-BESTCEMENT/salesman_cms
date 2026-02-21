// src/app/api/delete-user/route.ts -- workos only
import 'server-only';
import { NextResponse } from 'next/server';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';

const allowedAdminRoles = [
    'president',
    'senior-general-manager',
    'general-manager',
    'regional-sales-manager',
    'area-sales-manager',
    'senior-manager',
    'manager',
    'assistant-manager',
];

export async function POST(request: Request) {
    try {
        const workos = new WorkOS(process.env.WORKOS_API_KEY!);
        const claims = await getTokenClaims();

        // 1. Security Check
        if (!claims || !claims.sub || !allowedAdminRoles.includes(claims.role as string)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { workosUserId, email } = body;

        if (!workosUserId && !email) {
            return NextResponse.json({ error: 'Either WorkOS User ID or Email is required' }, { status: 400 });
        }

        const messages = [];

        // --- STEP 1: Delete the User (if they exist) ---
        let targetWorkosId = workosUserId;

        // If no ID, try to find the user by email
        if (!targetWorkosId && email) {
            const { data } = await workos.userManagement.listUsers({
                email: email,
                limit: 1,
            });
            if (data.length > 0) {
                targetWorkosId = data[0].id;
            }
        }

        if (targetWorkosId) {
            try {
                await workos.userManagement.deleteUser(targetWorkosId);
                messages.push('User profile deleted.');
            } catch (err: any) {
                if (err.status !== 404) {
                    console.error('Error deleting user profile:', err);
                    // We continue execution to ensure invites are also cleaned up
                }
            }
        }

        // --- STEP 2: Revoke Pending Invitations ---
        if (email) {
            try {
                const { data: invitations } = await workos.userManagement.listInvitations({
                    email: email,
                    limit: 10, // Fetch a few just in case
                });

                // Filter for pending invites only
                const pendingInvites = invitations.filter(inv => inv.state === 'pending');

                for (const invite of pendingInvites) {
                    await workos.userManagement.revokeInvitation(invite.id);
                }
                
                if (pendingInvites.length > 0) {
                    messages.push(`Revoked ${pendingInvites.length} pending invitation(s).`);
                }

            } catch (err) {
                console.error('Error cleaning up invitations:', err);
                // Don't fail the whole request if this part fails, but log it.
            }
        }

        return NextResponse.json({ 
            message: 'Cleanup complete.', 
            details: messages.join(' ') 
        }, { status: 200 });

    } catch (error: any) {
        console.error('❌ Critical error in delete-user route:', error);
        return NextResponse.json({ error: 'Failed to process deletion' }, { status: 500 });
    }
}