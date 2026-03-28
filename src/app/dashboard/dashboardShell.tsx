// src/app/dashboard/dashboardShell.tsx
'use client';

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { WorkOSRole } from '@/lib/permissions';

interface Company { 
  id: number;
  companyName: string;
  adminUserId: string;
}

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  company: Company;
}

interface DashboardShellProps {
  user: User;
  company: Company;
  children: React.ReactNode;
  role?: string;
  permissions?: string[];
}

export default function DashboardShell({ 
  children, 
  role,
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar 
        userRole={role as WorkOSRole}
      />
      <SidebarInset className="pl-4 pt-4 md:pl-6 md:pt-6">
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-2 @container/main">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}