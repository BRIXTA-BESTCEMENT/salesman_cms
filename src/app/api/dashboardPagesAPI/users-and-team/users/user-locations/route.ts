// src/app/api/dashboardPagesAPI/users-and-team/users/user-locations/route.ts
import "server-only";
import { connection, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/drizzle";
import { users } from "../../../../../../../drizzle";
import { eq, isNotNull, and } from "drizzle-orm";

export async function GET() {
  await connection();
  try {
    const session = await verifySession(); 
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserResult = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, session.userId))
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