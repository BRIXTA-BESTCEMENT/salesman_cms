// src/components/conditionalSidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { WorkOSRole } from '@/lib/permissions';
import { useEffect, useState } from 'react';

interface ConditionalSidebarProps {
  children: React.ReactNode;
}

interface CurrentUser {
  id: number;
  role: WorkOSRole;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
}

export function ConditionalSidebar({ children }: ConditionalSidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch current user role using existing users API with query param
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/dashboardPagesAPI/users-and-team/users?current=true'); 
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.currentUser);
        } else {
          console.error('Failed to fetch current user:', response.statusText);
          // Fallback user
          setCurrentUser({
            id: 0,
            role: 'junior-executive',
            firstName: 'Guest',
            lastName: 'User',
            email: 'guest@example.com',
            companyName: 'My Company'
          });
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        // Fallback user
        setCurrentUser({
          id: 0,
          role: 'junior-executive',
          firstName: 'Guest',
          lastName: 'User',
          email: 'guest@example.com',
          companyName: 'My Company'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchCurrentUser();
  }, []);
  
  // Don't show sidebar on home page, landing page, or auth pages
  const hideSidebar = pathname === '/home' 
                    || pathname === '/' 
                    //|| pathname === '/home/cemtemChat'
                    || pathname.startsWith('/auth')
                    // dashboard doesnt auto apply sidebar everywhere. That decision is made by dashboardShell
                    || pathname.startsWith('/dashboard')
                    // home doesnt auto apply sidebar everywhere. That decision is made by homeShell
                    || pathname.startsWith('/home')
                    || pathname.startsWith('/login/magicAuth'); 
  
  if (hideSidebar) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-64 bg-sidebar border-r">
          <div className="p-4">Loading...</div>
        </div>
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      <AppSidebar userRole={currentUser?.role || 'junior-executive'} />
      <main className="flex-1 w-full">
        {children}
      </main>
    </SidebarProvider>
  );
}