// src/app/api/auth/magic-auth/route.ts
import { WorkOS } from '@workos-inc/node';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../../drizzle'; 
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { MagicAuthEmail } from '@/components/InvitationEmail'; 
import { RESEND_API_KEY } from '@/lib/Reusable-constants';

const resend = new Resend(RESEND_API_KEY);

async function sendMagicAuthCodeEmailResend({
    to,
    code,
    companyName = 'Best Cement',
}: {
    to: string;
    code: string;
    companyName?: string;
}) {
    try {
        // Sanitize From Address
        const fromAddress = `"${companyName}" <noreply@bestcement.co.in>`;

        const data = await resend.emails.send({
            from: fromAddress,
            to: [to],
            subject: `Your login code for ${companyName}`,
            react: MagicAuthEmail({
                code,
                companyName
            }),
        });

        console.log("✅ Magic Auth email sent via Resend:", data);
        return data;
    } catch (error) {
        console.error("❌ Resend Error:", error);
        throw error;
    }
}

// Initialize the WorkOS client.
if (!process.env.WORKOS_API_KEY) {
    throw new Error('WORKOS_API_KEY is not set in environment variables');
}
const workos = new WorkOS(process.env.WORKOS_API_KEY);

export const POST = async (request: NextRequest) => {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
        }
        
        // --- CODE CREATION STAGE ---

        // Call WorkOS to create the Magic Auth code.
        const magicAuth = await workos.userManagement.createMagicAuth({
            email: email,
        });

        console.log(`✅ WorkOS created Magic Auth ID: ${magicAuth.id}`);

        // Get the Company Name for better email branding
        const result = await db
            .select({ companyName: companies.companyName })
            .from(users)
            .leftJoin(companies, eq(users.companyId, companies.id))
            .where(eq(users.email, email))
            .limit(1);

        // Use the actual company name in the sender
        const companyName = result[0]?.companyName || 'Best Cement';

        // Send email using your custom Nodemailer function
        if (magicAuth.code) {
            await sendMagicAuthCodeEmailResend({
                to: email,
                code: magicAuth.code,
                companyName: companyName,
            });
            console.log(`✅ Custom Magic Auth email sent to ${email} via Resend. Code: ${magicAuth.code}`);
        } else {
            console.error('WorkOS did not return a code for custom email delivery.');
            throw new Error('Could not retrieve login code from authentication service.');
        }

        // Return a successful response. 
        return NextResponse.json({
            success: true,
            message: 'A one-time login code has been sent to your email via custom mail service. Please check your inbox.',
            email: magicAuth.email,
        }, { status: 200 });

    } catch (error: any) {
        console.error('Magic Auth Create Handler Failed:', error);
        return NextResponse.json({
            error: 'An unexpected server error occurred while requesting the code.'
        }, { status: 500 });
    }
};

// Disable all other HTTP methods
export const GET = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
export const PATCH = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
export const PUT = () => NextResponse.json({ error: 'Method not allowed' }, { status: 405 });