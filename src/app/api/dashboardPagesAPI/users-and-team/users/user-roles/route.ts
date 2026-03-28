// src/app/api/dashboardPagesAPI/users-and-team/users/user-roles/route.ts
import "server-only";
import { connection, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { db } from "@/lib/drizzle";
import { users } from "../../../../../../../drizzle";
import { eq } from "drizzle-orm";

export async function GET() {
  await connection();
  try {
    const session = await verifySession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // prisma.user.findUnique(select companyId)
    const currentUserResult = await db
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const currentUser = currentUserResult[0];

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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