// src/app/api/dashboardPagesAPI/users-and-team/team-overview/editMasonMapping/route.ts
import 'server-only';
export const runtime = 'nodejs';
import { NextResponse, NextRequest } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Roles allowed to manage (assign/unassign) masons to salesmen
const allowedRoles = ['president', 'senior-general-manager', 'general-manager',
  'assistant-sales-manager', 'area-sales-manager', 'regional-sales-manager',
  'senior-manager', 'manager', 'assistant-manager',];

const editMasonSchema = z.object({
  userId: z.number(),
  masonIds: z.array(z.string()).optional().default([]), // Mason_PC_Side.id is String (uuid)
});

// =============== GET ===============
// Return ALL company masons (optionally filtered by area/region from query)
// AND the list of mason IDs already assigned to the given userId.
export async function GET(request: NextRequest) {
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
      where: {
        id: targetUserId,
        companyId: currentUser.companyId
      },
      select: {
        id: true,
        isTechnicalRole: true,
      },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found in your company" }, { status: 404 });
    }

    // 1) Fetch ALL masons for this company, optionally filtered by area/region (via their related dealer)
    const masonWhere: any = {
      OR: [
        { user: { companyId: currentUser.companyId } }, // Assigned to company user
        { dealer: { user: { companyId: currentUser.companyId } } }, // Linked to company dealer
        { userId: null } // Include unassigned masons so they can be picked up
      ]
    };
    // 3. Conditional Filtering on Dealer
    if (area) {
      masonWhere.dealer.area = area;
    }
    if (region) {
      masonWhere.dealer.region = region;
    }

    // 1) ALL masons for the company
    const masons = await prisma.mason_PC_Side.findMany({
      where: masonWhere,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        // Include dealer info for potential client-side filtering (like area/region)
        dealer: { select: { area: true, region: true, name: true } },
        userId: true, 
        dealerId: true,
      },
      orderBy: { name: "asc" },
    });

    // 2) Masons already assigned to this salesman (via Mason_PC_Side.userId = targetUserId)
    const assigned = await prisma.mason_PC_Side.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    });

    const assignedMasonIds = assigned.map((m: any) => m.id);

    return NextResponse.json({ masons, assignedMasonIds }, { status: 200 });
  } catch (err) {
    console.error("Mason mapping GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// =============== POST ===============
// Replace mapping: unassign all masons from user, then assign selected IDs.
export async function POST(request: NextRequest) {
  try {
    const claims = await getTokenClaims();
    const currentRole = claims?.role as string;
    if (!claims?.sub || !allowedRoles.includes(currentRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = editMasonSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { userId, masonIds } = parsed.data;

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
      return NextResponse.json({ error: "Not allwed to update from a different company forbidden" }, { status: 403 });
    }

    // 1. Unassign all existing masons from this user
    await prisma.mason_PC_Side.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // 2. Assign the provided set of masons to the target user
    if (masonIds.length > 0) {
      await prisma.mason_PC_Side.updateMany({
        where: { id: { in: masonIds } },
        data: { userId },
      });
    }

    // Return the updated user with their new mason assignments (via the 'assignedMasons' relation)
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { assignedMasons: true }, // Use the new relation name
    });

    return NextResponse.json(
      { message: "Mason mapping updated", user: updatedUser },
      { status: 200 }
    );
  } catch (err) {
    console.error("Mason mapping POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}