// src/app/api/setup-company/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { db } from '@/lib/drizzle';
import { users, companies } from '../../../../drizzle'; 
import { eq } from 'drizzle-orm';
import { WorkOS } from '@workos-inc/node';
import { z } from 'zod';

const workos = new WorkOS(process.env.WORKOS_API_KEY as string);

// Schema for the POST request body
const SetupCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  officeAddress: z.string().min(1, "Office address is required."),
  isHeadOffice: z.boolean(),
  phoneNumber: z.string().min(1, "Phone number is required.").max(20, "Phone number is too long."),
  region: z.string(),
  area: z.string(),
});


export async function POST(request: Request) {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: No authenticated user found.' }, { status: 401 });
    }

    console.log('✅ Authenticated user:', { id: user.id, email: user.email });

    const body = await request.json();
    const parsedBody = SetupCompanySchema.safeParse(body);

    if (!parsedBody.success) {
      console.error('Company Setup Validation Error:', parsedBody.error.format());
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: parsedBody.error.format() 
      }, { status: 400 });
    }

    const { companyName, officeAddress, isHeadOffice, phoneNumber, region, area } = parsedBody.data;

    const existingCompanyResult = await db
      .select()
      .from(companies)
      .where(eq(companies.adminUserId, user.id))
      .limit(1);

    const existingCompanyInDb = existingCompanyResult[0];

    if (existingCompanyInDb) {
      return NextResponse.json({ error: 'Company already set up for this user in your database.' }, { status: 409 });
    }

    // Create WorkOS Organization
    let workosOrganization;
    try {
      workosOrganization = await workos.organizations.createOrganization({
        name: companyName,
        metadata: {
          adminUserId: user.id,
        },
      });
      console.log(`✅ WorkOS Organization created: '${workosOrganization.name}' with ID: ${workosOrganization.id}`);
    } catch (workosOrgError: any) {
      console.error('❌ Error creating WorkOS Organization:', workosOrgError);
      return NextResponse.json({ 
        error: 'Failed to create WorkOS Organization.', 
        details: workosOrgError.message 
      }, { status: 500 });
    }

    // Create WorkOS Organization Membership with the 'senior-manager' role
    try {
      console.log('👤 Creating organization membership for senior-manager role...');
      
      const membership = await workos.userManagement.createOrganizationMembership({
        userId: user.id,
        organizationId: workosOrganization.id,
        roleSlug: 'senior-manager', // Set the initial role here
      });
      
      console.log(`✅ WorkOS Organization Membership created:`, {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        roleSlug: membership.role
      });
      
    } catch (membershipError: any) {
      console.error('❌ Error creating WorkOS Organization Membership:', {
        error: membershipError,
        message: membershipError.message,
        code: membershipError.code,
        status: membershipError.status
      });
      
      // Clean up the organization if membership fails
      try {
        await workos.organizations.deleteOrganization(workosOrganization.id);
        console.log(`✅ Cleaned up WorkOS Organization ${workosOrganization.id}`);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup organization:', cleanupError);
      }
      
      return NextResponse.json({ 
        error: 'Failed to create WorkOS Organization Membership for admin.',
        details: membershipError.message,
        code: membershipError.code
      }, { status: 500 });
    }

    // Create database records
    const newCompanyResult = await db.insert(companies).values({
      companyName,
      officeAddress,
      isHeadOffice,
      phoneNumber,
      region: region, 
      area: area,     
      adminUserId: user.id,
      workosOrganizationId: workosOrganization.id,
    }).returning();

    const newCompany = newCompanyResult[0];

    // Create the initial user with the senior-manager role and the new fields
    const newAdminUserResult = await db.insert(users).values({
      workosUserId: user.id,
      companyId: newCompany.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      role: 'senior-manager', 
      region: region, 
      area: area,     
    }).returning();

    const newAdminUser = newAdminUserResult[0];

    console.log('🎉 Company setup completed successfully!');
    return NextResponse.json({
      message: 'Company profile and WorkOS Organization created successfully!',
      company: newCompany,
      adminUser: newAdminUser,
      workosOrganizationId: workosOrganization.id,
    }, { status: 201 });

  } catch (error: any) {
    console.error('💥 Unexpected API Error during company setup:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error during company setup.',
    }, { status: 500 });
  }
}
