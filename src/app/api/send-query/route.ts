// src/app/api/send-query/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';

export async function POST(request: Request) {
  try {
    const claims = await getTokenClaims();
    const senderEmail = claims?.email as string | undefined;
    const senderId = claims?.sub as string | undefined;

    const { subject, message } = await request.json();

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
      secure: process.env.EMAIL_SERVER_PORT === '465',
      auth: {
        user: process.env.GMAIL_USER,       // <--- UPDATED: Use your GMAIL_USER
        pass: process.env.GMAIL_APP_PASSWORD, // <--- UPDATED: Use your GMAIL_APP_PASSWORD
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.DEVELOPER_EMAIL,
      subject: `New Query: ${subject}`,
      html: `
        <p><strong>From User:</strong> ${senderEmail || 'N/A'}</p>
        <p><strong>WorkOS User ID:</strong> ${senderId || 'N/A'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Query sent successfully!' }, { status: 200 });

  } catch (error: any) {
    console.error('Error sending query email:', error);
    return NextResponse.json({ error: 'Failed to send query. Please check server logs.' }, { status: 500 });
  }
}