// src/app/home/layout.tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/drizzle";
import { users, companies } from "../../../drizzle";
import { eq } from "drizzle-orm";
import HomeShell from "@/app/home/homeShell";
import type { Metadata } from "next";
import { verifySession } from "@/lib/auth"; 

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
  
  // 1. Verify custom session
  const session = await verifySession();

  if (!session || !session.userId) {
    redirect("/login");
  }

  // 2. Fetch User from DB using local integer ID
  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      firstName: users.firstName, 
      lastName: users.lastName,   
      companyId: companies.id,
      companyName: companies.companyName,
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.id, session.userId))
    .limit(1);

  const dbUser = result[0];

  if (!dbUser) {
    redirect("/login");
  }

  if (!dbUser.companyId) {
    console.error("User has no company access. Redirecting to setup.");
    redirect("/setup-company");
  }

  const finalRole = dbUser.role || "junior-executive";
  const permissions: string[] = []; // RBAC arrays go here later!

  const mappedUser = {
    id: dbUser.userId,
    email: dbUser.email,
    role: dbUser.role,
    firstName: dbUser.firstName, 
    lastName: dbUser.lastName,   
    company: {
      id: dbUser.companyId!,
      companyName: dbUser.companyName!,
      adminUserId: dbUser.userId.toString(),
    },
  };

  return (
    <HomeShell
      user={mappedUser}
      company={mappedUser.company}
      role={finalRole}
      permissions={permissions}
    >
      {children}
    </HomeShell>
  );
}