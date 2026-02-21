// src/app/home/layout.tsx

import { Suspense } from "react";
import { withAuth, getTokenClaims } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/drizzle";
import { users, companies } from "../../../drizzle";
import { eq } from "drizzle-orm";
import HomeShell from "@/app/home/homeShell";
import type { Metadata } from "next";

async function refreshUserJWTIfNeeded(user: any, claims: any) {
  if (!claims?.org_id) {
    console.log("⚠️ JWT missing organization data, checking database...");

    const result = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.workosUserId, user.id))
      .limit(1);

    const dbUser = result[0];

    if (dbUser) {
      console.log(
        `🔄 User ${dbUser.email || user.id} detected with incomplete JWT - forcing refresh.`
      );
      return { needsRefresh: true };
    }
  }
  return { needsRefresh: false };
}

export const metadata: Metadata = {
  icons: { icon: "/favicon.ico" },
};

export default function CemTemChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-muted-foreground mt-4">Loading...</p>}>
      <AuthenticatedHomeLayout>{children}</AuthenticatedHomeLayout>
    </Suspense>
  );
}

export async function AuthenticatedHomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { user } = await withAuth();
  const claims = await getTokenClaims();

  if (!user) {
    redirect("/login");
  }

  // prisma.user.findUnique({ include: { company: true } })
  let result = await db
    .select({
      userId: users.id,
      workosUserId: users.workosUserId,
      email: users.email,
      role: users.role,
      status: users.status,
      inviteToken: users.inviteToken,
      firstName: users.firstName, 
      lastName: users.lastName,   
      companyId: companies.id,
      companyName: companies.companyName,
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.workosUserId, user.id))
    .limit(1);

  let dbUser = result[0];

  // Account Linking Logic
  if (!dbUser) {
    const userByEmail = await db
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.email, user.email!))
      .limit(1);

    if (userByEmail[0]) {
      console.log(
        `🔗 Linking existing user account ${userByEmail[0].email} with WorkOS ID ${user.id}`
      );

      await db
        .update(users)
        .set({
          workosUserId: user.id,
          status: "active",
          inviteToken: null,
          role: (claims?.role as string) || userByEmail[0].role,
        })
        .where(eq(users.id, userByEmail[0].id));

      // re-fetch updated user + company
      result = await db
        .select({
          userId: users.id,
          workosUserId: users.workosUserId,
          email: users.email,
          role: users.role,
          status: users.status,             
          inviteToken: users.inviteToken,   
          firstName: users.firstName,
          lastName: users.lastName,
          companyId: companies.id,
          companyName: companies.companyName,
        })
        .from(users)
        .leftJoin(companies, eq(users.companyId, companies.id))
        .where(eq(users.id, userByEmail[0].id))
        .limit(1);

      dbUser = result[0];
    } else {
      console.error(
        "❌ User exists in WorkOS but not in the local database. Redirecting to setup."
      );
      redirect("/setup-company");
    }
  }

  const refreshCheck = await refreshUserJWTIfNeeded(user, claims);
  if (refreshCheck.needsRefresh) {
    redirect("/auth/refresh?returnTo=/home");
  }

  const workosRole = claims?.role as string | undefined;

  if (workosRole && dbUser.role !== workosRole) {
    console.log(`🔄 Updating user role from ${dbUser.role} to ${workosRole}`);

    await db
      .update(users)
      .set({ role: workosRole })
      .where(eq(users.id, dbUser.userId));

    dbUser.role = workosRole;
  }

  if (!dbUser.companyId) {
    console.error("User has no company access. Redirecting to setup.");
    redirect("/setup-company");
  }

  const finalRole = dbUser.role || "senior-executive";
  const permissions = (claims?.permissions as string[]) || [];
  const mappedUser = {
    id: dbUser.userId,
    email: dbUser.email,
    role: dbUser.role,
    firstName: dbUser.firstName, 
    lastName: dbUser.lastName,   
    company: {
      id: dbUser.companyId!,
      companyName: dbUser.companyName!,
      adminUserId: dbUser.userId.toString(), // adjust if different column exists
    },
  };

  return (
    <HomeShell
      user={mappedUser}
      company={mappedUser.company}
      workosRole={finalRole}
      permissions={permissions}
    >
      {children}
    </HomeShell>
  );
}