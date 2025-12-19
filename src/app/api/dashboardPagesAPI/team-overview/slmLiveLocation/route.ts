// src/app/api/dashboardPagesAPI/team-overview/slmLiveLocation/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import prisma from "@/lib/prisma";
import axios from "axios";
import { z } from "zod";

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
  'senior-executive',];

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
            region: true, // Assuming these fields are on the User model
            area: true,   // Assuming these fields are on the User model
          },
        },
      },
    });

    // Extract the user IDs from the active plans
    const activeSalesmen = activePlans.map((plan:any) => plan.user);
    const salesmanIds = activeSalesmen.map((s:any) => String(s.id));

    if (salesmanIds.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    //const slmWebAppURL = process.env.NEXT_PUBLIC_SALESMAN_APP_URL; // actual salesman mobile webapp
    const slmServerURL = process.env.NEXT_PUBLIC_SALESMAN_APP_SERVER_URL; // backend server for the mobile webapp

    // --- NEW: fetch latest points from the salesman app backend ---
    if (!slmServerURL) {
      console.error("SALESMAN_APP_SERVER_URL is not set");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Fetch latest endpoint for each active salesman concurrently (safe-fail)
    type FetchResult = | { ok: true; data: any } | { ok: false; error: any };

    const fetchPromises: Promise<FetchResult>[] = salesmanIds.map((id:any) =>
      axios
        .get(`${slmServerURL}/api/geotracking/user/${id}/latest`, { timeout: 5000 })
        .then((r) => ({ ok: true as const, data: r.data }))
        .catch((e) => {
          console.warn(`Failed to fetch latest for user ${id}:`, e?.message ?? e);
          return { ok: false as const, error: e };
        })
    );

    const settled: FetchResult[] = await Promise.all(fetchPromises);

    // Normalize results into your frontend shape
    const mapped = settled
      .map((resItem, idx) => {
        // Narrow safely: ensure this item has a `data` property
        if (!resItem || !("data" in resItem)) return null;

        const respBody = resItem.data; // now safe
        if (!respBody || !respBody.success) return null;
        const latest = respBody.data;
        if (!latest) return null; // user has no points yet

        // Find the user metadata from your DB list (activeSalesmen)
        const user = activeSalesmen.find((u:any) => String(u.id) === String(salesmanIds[idx]));
        if (!user) return null;

        // Map the latest DB row to the liveLocationSchema shape
        return {
          userId: String(user.id),
          salesmanName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A",
          employeeId: user.salesmanLoginId ?? null,
          role: user.role,
          region: user.region ?? null,
          area: user.area ?? null,
          latitude: Number(latest.latitude),
          longitude: Number(latest.longitude),
          recordedAt: latest.recordedAt ? String(latest.recordedAt) : new Date().toISOString(),
          isActive: latest.isActive === undefined ? true : Boolean(latest.isActive),
          accuracy: latest.accuracy ?? null,
          speed: latest.speed ?? null,
          heading: latest.heading ?? null,
          altitude: latest.altitude ?? null,
          batteryLevel: latest.batteryLevel ?? null,
        };
      })
      .filter(Boolean) as unknown as Array<z.infer<typeof liveLocationSchema>>; // help TS understand type

    // Validate whole array with Zod
    const validated = z.array(liveLocationSchema).parse(mapped);

    return NextResponse.json(validated, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching live locations from Radar:", error.response?.data || error.message);
    return NextResponse.json({ error: "Failed to fetch live locations" }, { status: 500 });
  }
}
