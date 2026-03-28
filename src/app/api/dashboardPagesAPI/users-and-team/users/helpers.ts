// src/app/api/dashboardPagesAPI/users-and-team/users/helpers.ts
import { Resend } from "resend";
import { InvitationEmail } from "@/components/InvitationEmail";
import { RESEND_API_KEY } from "@/lib/Reusable-constants";

const resend = new Resend(RESEND_API_KEY);

export function generateRandomPassword(length: number = 8): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

interface SendEmailProps {
    to: string;
    firstName: string;
    lastName?: string;
    companyName: string | null;
    adminName: string;
    dashboardUrl: string;
    inviteUrl?: string | null;
    role: string | null;
    
    // Optional credentials based on access
    dashboardEmail?: string | null;
    dashboardTempPassword?: string | null;
    salesmanLoginId?: string | null;
    salesmanTempPassword?: string | null;
    techLoginId?: string | null;
    techTempPassword?: string | null;
    adminAppLoginId?: string | null;
    adminAppTempPassword?: string | null;
}

export async function sendInvitationEmailResend(props: SendEmailProps) {
    try {
        const fromAddress = props.companyName
            ? `"${props.companyName}" <noreply@bestcement.co.in>`
            : `noreply@bestcement.co.in`;

        const data = await resend.emails.send({
            from: fromAddress,
            to: [props.to],
            subject: `Your access credentials for ${props.companyName}`,
            react: InvitationEmail({
                firstName: props.firstName,
                lastName: props.lastName,
                adminName: props.adminName,
                companyName: props.companyName || '',
                role: props.role || 'Team Member', // Added missing role prop
                dashboardUrl: props.dashboardUrl,
                dashboardEmail: props.dashboardEmail,
                dashboardTempPassword: props.dashboardTempPassword,
                salesmanLoginId: props.salesmanLoginId,
                tempPassword: props.salesmanTempPassword || '', // Fixed prop name mapped to InvitationEmail
                techLoginId: props.techLoginId,
                techTempPassword: props.techTempPassword,
                adminAppLoginId: props.adminAppLoginId,
                adminAppTempPassword: props.adminAppTempPassword
            }) as React.ReactElement,
        });

        return data;
    } catch (error) {
        console.error("❌ Resend Error:", error);
        throw error;
    }
}