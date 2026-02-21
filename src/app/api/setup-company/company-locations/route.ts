// src/app/api/setup-company/company-locations/route.ts
import 'server-only';
import { connection, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { companies } from '../../../../../drizzle'; 
import { isNotNull } from 'drizzle-orm';

//GET handler to fetch unique regions and areas from the Company table.
export async function GET() {
    await connection();
    try {
        // Fetch all unique regions from the Company table
        const uniqueRegions = await db
            .selectDistinct({ region: companies.region })
            .from(companies)
            .where(isNotNull(companies.region));

        // Fetch all unique areas from the Company table
        const uniqueAreas = await db
            .selectDistinct({ area: companies.area })
            .from(companies)
            .where(isNotNull(companies.area));

        // Extract string values and filter out any nulls
        const regions = uniqueRegions.map((r:any) => r.region).filter(Boolean) as string[];
        const areas = uniqueAreas.map((a:any) => a.area).filter(Boolean) as string[];

        return NextResponse.json({ regions, areas }, { status: 200 });

    } catch (error) {
        console.error('Error fetching company locations:', error);
        return NextResponse.json({ error: 'Failed to fetch company locations' }, { status: 500 });
    }
}
