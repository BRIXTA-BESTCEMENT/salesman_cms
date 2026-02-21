// src/lib/company-service.ts

import { db } from "@/lib/drizzle";
import { users, companies } from "../../drizzle";
import { eq, and, count } from "drizzle-orm";

export interface CompanyInfo {
  companyName: string;
  companyId: number;
  adminName: string;
  adminEmail: string;
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
}

export async function getCompanyInfo(workosUserId: string): Promise<CompanyInfo | null> {
  try {
    // Equivalent of prisma.user.findUnique({ include: { company: true } })
    const result = await db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        companyId: companies.id,
        companyName: companies.companyName,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.workosUserId, workosUserId))
      .limit(1);

    const user = result[0];

    if (!user || !user.companyId) {
      return null;
    }

    // prisma.user.count()
    const [{ count: totalUsers }] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.companyId, user.companyId));

    const [{ count: activeUsers }] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.companyId, user.companyId),
          eq(users.status, "active")
        )
      );

    const [{ count: pendingUsers }] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.companyId, user.companyId),
          eq(users.status, "pending")
        )
      );

    return {
      companyName: user.companyName!,
      companyId: user.companyId,
      adminName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      adminEmail: user.email!,
      totalUsers: Number(totalUsers),
      activeUsers: Number(activeUsers),
      pendingUsers: Number(pendingUsers),
    };
  } catch (error) {
    console.error("Error in getCompanyInfo:", error);
    return null;
  }
}