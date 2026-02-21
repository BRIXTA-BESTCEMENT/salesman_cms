// src/app/api/dashboardPagesAPI/users-and-team/users/user-roles/route.ts
import "server-only";
import { connection, NextResponse } from "next/server";
import { getTokenClaims } from "@workos-inc/authkit-nextjs";
import { db } from "@/lib/drizzle";
import { users } from "../../../../../../../drizzle";
import { eq } from "drizzle-orm";

export async function GET() {
  await connection();
  try {
    const claims = await getTokenClaims();
    if (!claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // prisma.user.findUnique(select companyId)
    const currentUserResult = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.workosUserId, claims.sub))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // prisma distinct role
    const uniqueRoles = await db
      .selectDistinct({ role: users.role })
      .from(users)
      .where(eq(users.companyId, currentUser.companyId));

    const roles = uniqueRoles
      .map((r) => r.role ?? "")
      .filter(Boolean);

    return NextResponse.json({ roles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
      { status: 500 }
    );
  }
}