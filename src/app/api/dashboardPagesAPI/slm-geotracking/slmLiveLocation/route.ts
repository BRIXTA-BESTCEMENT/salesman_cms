// src/app/api/dashboardPagesAPI/slm-geotracking/slmLiveLocation/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import prisma from "@/lib/prisma";
import axios from "axios";
import { z } from "zod";

const RADAR_SECRET_KEY = process.env.RADAR_SECRET_KEY;

// Zod schema for one live location
const liveLocationSchema = z.object({
  userId: z.string(), // 👈 Radar externalId = id in users table
  salesmanName: z.string(),
  employeeId: z.string().nullable(),
  role: z.string(),
  region: z.string().nullable(),
  area: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  recordedAt: z.string(),
  isActive: z.boolean(),
  accuracy: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  altitude: z.number().nullable(),
  batteryLevel: z.number().nullable(),
});

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',
];

export async function GET() {
  try {
    const claims = await getTokenClaims();

    // Auth check
    if (!claims || !claims.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
    });

    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view live locations." },
        { status: 403 }
      );
    }

    // 1. Get all active permanent journey plans for the current company
    const activePlans = await prisma.permanentJourneyPlan.findMany({
      where: {
        // Filter by the user's company who is assigned to the plan
        user: {
          companyId: currentUser.companyId,
        },
        status: "IN_PROGRESS",
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            salesmanLoginId: true,
            region: true,
            area: true,
          },
        },
      },
    });

if (activePlans.length === 0) return NextResponse.json([]);

    // 2. Fetch Live Locations from Radar for these specific User IDs
    // We use Radar's Users Search API to get latest state for multiple IDs
    const userIds = activePlans.map(p => String(p.user.id)).join(',');
    
    const radarResponse = await axios.get(
      `https://api.radar.io/v1/users?externalIds=${userIds}`,
      {
        headers: { Authorization: RADAR_SECRET_KEY }
      }
    );

    const radarUsers = radarResponse.data.users || [];

    // 3. Merge DB Metadata with Radar Live Coordinates
    const liveData = activePlans.map((plan) => {
      const user = plan.user;
      const radarState = radarUsers.find((u: any) => u.externalId === String(user.id));

      if (!radarState || !radarState.location) return null;

      return {
        userId: String(user.id),
        salesmanName: `${user.firstName} ${user.lastName}`.trim(),
        employeeId: user.salesmanLoginId,
        role: user.role,
        region: user.region,
        area: user.area,
        // LIVE DATA FROM RADAR:
        latitude: radarState.location.coordinates[1],
        longitude: radarState.location.coordinates[0],
        recordedAt: radarState.updatedAt,
        isActive: true,
        batteryLevel: radarState.device?.battery?.level ?? null,
        speed: radarState.location.speed ?? 0,
      };
    }).filter(Boolean);

    return NextResponse.json(liveData);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}