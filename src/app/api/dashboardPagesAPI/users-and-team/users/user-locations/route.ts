// src/app/api/dashboardPagesAPI/users-and-team/users/user-locations/route.ts
import "server-only";
import { connection, NextResponse } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import { db } from "@/lib/drizzle";
import { users } from "../../../../../../../drizzle";
import { eq, isNotNull, and } from "drizzle-orm";

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserResult = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // DISTINCT regions
    const uniqueRegions = await db
      .selectDistinct({ region: users.region })
      .from(users)
      .where(
        and(
          eq(users.companyId, currentUser.companyId),
          isNotNull(users.region)
        )
      );

    // DISTINCT areas
    const uniqueAreas = await db
      .selectDistinct({ area: users.area })
      .from(users)
      .where(
        and(
          eq(users.companyId, currentUser.companyId),
          isNotNull(users.area)
        )
      );

    const regions = uniqueRegions
      .map((r) => r.region ?? "")
      .filter(Boolean);

    const areas = uniqueAreas
      .map((a) => a.area ?? "")
      .filter(Boolean);

    return NextResponse.json({ regions, areas }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch user locations" },
      { status: 500 }
    );
  }
}