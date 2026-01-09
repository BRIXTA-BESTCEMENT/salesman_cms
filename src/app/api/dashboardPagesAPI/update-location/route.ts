// src/app/api/dashboardPagesAPI/update-location/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTokenClaims } from '@workos-inc/authkit-nextjs';
import { z } from 'zod';

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
    'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
    'senior-manager', 'manager', 'assistant-manager',
    'senior-executive',];

const updateSchema = z.object({
    id: z.string(),
    address: z.string().min(5), // Basic validation
});

export async function POST(request: NextRequest) {
    try {
        const claims = await getTokenClaims();
        // 1. Authentication Check
        if (!claims || !claims.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Current User to check role and companyId
        const currentUser = await prisma.user.findUnique({
            where: { workosUserId: claims.sub },
            select: { id: true, role: true, companyId: true } // Optimized selection
        });

        // --- UPDATED ROLE-BASED AUTHORIZATION ---
        if (!currentUser || !allowedRoles.includes(currentUser.role)) {
            return NextResponse.json({ error: `Forbidden: Only the following roles can view attendance data: ${allowedRoles.join(', ')}` }, { status: 403 });
        }

        //  Parse Body
        const body = await request.json();
        const { id, address } = updateSchema.parse(body);

        //  Update Database (Overwrite locationName)
        const updated = await prisma.salesmanAttendance.update({
            where: { id },
            data: {
                locationName: address, // <--- SAVING THE RESOLVED ADDRESS HERE
                updatedAt: new Date()
            },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}