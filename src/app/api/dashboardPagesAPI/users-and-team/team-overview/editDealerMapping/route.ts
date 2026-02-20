// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editDealerMapping/route.ts
import 'server-only';
import { NextResponse, NextRequest, connection } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import prisma from "@/lib/prisma";
import { z } from "zod";

const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',];

const editDealerSchema = z.object({
  userId: z.number(),
  dealerIds: z.array(z.string()).optional().default([]), // dealer.id is String (uuid)
});

// =============== GET ===============
// Return ALL company dealers (optionally filtered by area/region from query)
// AND the list of dealer IDs already assigned to the given userId.
export async function GET(request: NextRequest) {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId");
    const area = url.searchParams.get("area");
    const region = url.searchParams.get("region");

    const targetUserId = userIdParam ? parseInt(userIdParam, 10) : NaN;
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
    }

    // Who's making the call
    const currentUser = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { id: true, role: true, companyId: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "Current user not found" }, { status: 404 });
    }
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure target user is in same company
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found in your company" }, { status: 404 });
    }

    // 1) Fetch ALL dealers for this company, optionally filtered by area/region from the popup
    // Filter via the related user who created/owns the dealer record.
    const dealerWhere: any = {
      OR: [
        { user: { companyId: currentUser.companyId } }, // Owned by my company
        { userId: null } // Unassigned dealers (orphans)
      ]
    };
    if (area) dealerWhere.area = area;
    if (region) dealerWhere.region = region;

    // 1) ALL dealers for the company (optionally filtered by area/region)
    const dealers = await prisma.dealer.findMany({
      where: dealerWhere,
      select: { id: true, name: true, area: true, region: true },
      orderBy: { name: "asc" },
    });

    // 2) Dealers already assigned to this salesman (via dealer.userId = targetUserId)
    const assigned = await prisma.dealer.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });

    const assignedDealerIds = assigned.map((d:any) => d.id);

    return NextResponse.json({ dealers, assignedDealerIds }, { status: 200 });
  } catch (err) {
    console.error("Dealer mapping GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============== POST ===============
// Replace mapping: unassign all from user, then assign selected IDs.
export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    const currentRole = claims?.role as string;
    if (!claims?.sub || !allowedRoles.includes(currentRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = editDealerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { userId, dealerIds } = parsed.data;

    // Optional: ensure the editor and the target user share company
    const caller = await prisma.user.findUnique({
      where: { workosUserId: claims.sub },
      select: { companyId: true },
    });
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!caller || !target || caller.companyId !== target.companyId) {
      return NextResponse.json({ error: "Cross-company update forbidden" }, { status: 403 });
    }

    // Unassign all existing dealers from this user
    await prisma.dealer.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // Assign the provided set
    if (dealerIds.length > 0) {
      await prisma.dealer.updateMany({
        where: { id: { in: dealerIds } },
        data: { userId },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { dealers: true },
    });

    return NextResponse.json(
      { message: "Dealer mapping updated", user: updatedUser },
      { status: 200 }
    );
  } catch (err) {
    console.error("Dealer mapping POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
