// src/app/api/dashboardPagesAPI/update-location/route.ts
import 'server-only';
import { NextRequest, NextResponse, connection } from 'next/server';
import { db } from '@/lib/drizzle';
import { users, salesmanAttendance } from '../../../../../drizzle';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { verifySession } from '@/lib/auth';

const updateSchema = z.object({
    id: z.string(), // We keep string as it's passed from the frontend
    address: z.string().min(5), // Basic validation
});

export async function POST(request: NextRequest) {
    if (typeof connection === 'function') await connection();

    try {
        const session = await verifySession();
        if (!session || !session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const hasRequiredPerms = session.permissions.includes('UPDATE') || session.permissions.includes('WRITE');
        if (!hasRequiredPerms) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const parsedBody = updateSchema.safeParse(body);

        if (!parsedBody.success) {
            return NextResponse.json({
                message: 'Invalid request body',
                errors: parsedBody.error.format()
            }, { status: 400 });
        }

        const { id, address } = parsedBody.data;

        // 5. Update Database (Overwrite locationName)
        // Ensure ID type matches your DB (if it's a numeric ID, wrap in Number(id), otherwise string is fine for UUIDs)
        const updatedResult = await db
            .update(salesmanAttendance)
            .set({
                locationName: address, // <--- SAVING THE RESOLVED ADDRESS HERE
                updatedAt: new Date().toISOString() // Drizzle string mode timestamp
            })
            // If salesmanAttendance.id is an integer in your schema, use Number(id) here
            // If it's a bigint or UUID, passing `id` as a string is perfect.
            .where(eq(salesmanAttendance.id, Number(id) || id as any))
            .returning();

        const updated = updatedResult[0];

        if (!updated) {
            return NextResponse.json({ error: 'Record not found or update failed' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    } catch (error) {
        console.error("Error updating location:", error);
        return NextResponse.json({ error: 'Update failed', details: (error as Error).message }, { status: 500 });
    }
}