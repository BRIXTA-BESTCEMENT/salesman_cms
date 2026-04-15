// src/components/app-sidebar.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import Image from 'next/image';

interface Props {
  userRole: string; // Changed from WorkOSRole to string
  companyId?: number; 
  permissions: string[]; // ['READ', 'WRITE', 'UPDATE']
  jobRoles?: string[]; // Array of user's job roles
}

interface MenuItem {
  title: string;
  url?: string;
  requiredPerm?: string | string[] | 'public' | 'logout'; 
  allowedCompanyIds?: number[]; 
  requiredJobRole?: string[]; // Array of required job roles to view this item
  items?: MenuItem[];
}

// Define menu items with the new nested structure
const menuItems: MenuItem[] = [
  {
    title: "Home",
    url: "/home",
    requiredPerm: 'public',
    items: [
      // {
      //   title: "CemTem ChatBot",
      //   url: "/home/cemtemChat",
      //   permission: ITEM_PERMISSIONS["CemTem ChatBot"]
      // },
      {
        title: "Custom Report Generator",
        url: "/home/customReportGenerator",
        requiredPerm: ['READ']
      },
    ],
  },
  {
    title: "Business Dashboard",
    url: "/dashboard",
    requiredPerm: 'public',
    items: [
      {
        title: "Users & Team",
        url: "/dashboard/usersAndTeam",
        requiredPerm: ['READ', 'WRITE', 'UPDATE'],
        requiredJobRole: ['Admin']
      },
      {
        title: "Dealers",
        url: "/dashboard/dealerManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Technical Sites",
        url: "/dashboard/technicalSites",
        requiredPerm: ['READ'],
        requiredJobRole: ['Technical-Sales']
      },
      {
        title: "Reports",
        url: "/dashboard/reports",
        requiredPerm: ['READ']
      },
      {
        title: "PJPs (Sales Side)", // Assign Tasks hander
        url: "/dashboard/assignTasks",
        requiredPerm: ['READ', 'WRITE', 'UPDATE'],
        requiredJobRole: ['Sales-Marketing', 'Reports-MIS']
      },
      {
        title: "PJPs (Technical Side)", // Permanent Journey Plan handler
        url: "/dashboard/permanentJourneyPlan",
        requiredPerm: ['READ', 'WRITE', 'UPDATE'],
        requiredJobRole: ['Technical-Sales', 'Reports-MIS']
      },
      {
        title: "Salesman Geotracking",
        url: "/dashboard/slmGeotracking",
        requiredPerm: ['READ']
      },
      {
        title: "Salesman Leaves",
        url: "/dashboard/slmLeaves",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Salesman Attendance",
        url: "/dashboard/slmAttendance",
        requiredPerm: ['READ']
      },
      // {
      //   title: "Scores & Ratings",
      //   url: "/dashboard/scoresAndRatings",
      //   requiredPerm: ['READ']
      // },
      {
        title: "Mason - PC Side",
        url: "/dashboard/masonpcSide",
        requiredPerm: ['READ', 'WRITE', 'UPDATE'],
        requiredJobRole: ['Technical-Sales', 'Reports-MIS']
      },
      {
        title: "Sales Orders - Payments",
        url: "/dashboard/ordersPayments",
        requiredPerm: ['READ', 'WRITE', 'UPDATE'],
        requiredJobRole: ['Accounting']
      },
      // {
      //   title: "Logistics IO",
      //   url: "/dashboard/logisticsIO",
      //   requiredPerm: ['READ', 'WRITE', 'UPDATE']
      // },
    ],
  },
  {
    title: "Account",
    url: "/account",
    requiredPerm: 'public',
    items: [
      {
        title: "Logout",
        url: "/api/auth/logout",
        requiredPerm: 'logout'
      },
    ],
  },
]

export function AppSidebar({ userRole, permissions = [], companyId, jobRoles = [] }: Props) {

  const [userName, setUserName] = useState<string>("Loading...");
  const [companyName, setCompanyName] = useState<string>("Loading...");

  // Fetch data directly on mount
  useEffect(() => {
    const fetchSidebarData = async () => {
      try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setCompanyName(data.companyName || "Company Name");
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
          setUserName(fullName || "User Name");
        } else {
          setCompanyName("Session Expired");
          setUserName("");
        }
      } catch (error) {
        console.error("Failed to fetch sidebar info:", error);
        setCompanyName("Error");
        setUserName("");
      }
    };

    fetchSidebarData();
  }, []);

  // Filter based on the 'permissions' array from the DB
  const filterItems = useCallback((items: MenuItem[]): MenuItem[] => {
    if (!permissions) return [];

    const isAdmin = permissions.includes('ALL_ACCESS');

    return items.reduce((acc, item) => {
      const { requiredPerm, allowedCompanyIds, requiredJobRole } = item;

      // 1. MULTI-TENANT CHECK
      if (allowedCompanyIds && allowedCompanyIds.length > 0) {
        if (!companyId || !allowedCompanyIds.includes(companyId)) {
          return acc; 
        }
      }

      // 2. JOB ROLE CHECK
      if (requiredJobRole && requiredJobRole.length > 0) {
        // If user doesn't have ANY of the required job roles AND isn't an Admin, hide it
        const hasRequiredRole = requiredJobRole.some(role => jobRoles.includes(role));
        if (!hasRequiredRole && !isAdmin) {
          return acc;
        }
      }

      // 3. PERMISSIONS CHECK
      if (!requiredPerm || requiredPerm === 'public' || requiredPerm === 'logout') {
        acc.push(item.items ? { ...item, items: filterItems(item.items) } : item);
        return acc;
      }

      // Handle Multiple Permissions (Check if user has ALL)
      const requiredArray = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
      const hasAllAccess = requiredArray.some(p => permissions.includes(p) || isAdmin);

      if (hasAllAccess) {
        if (item.items) {
          acc.push({ ...item, items: filterItems(item.items) });
        } else {
          acc.push(item);
        }
      }
      
      return acc;
    }, [] as MenuItem[]);
  }, [permissions]); // Re-run if permissions change

  const accessibleMenuItems = useMemo(() => filterItems(menuItems), [filterItems]);

  return (
    <Sidebar className="hidden md:flex w-64 shrink-0 border-r">
      {/* <SidebarRail className="md:hidden" /> */}

      <SidebarContent>
        <SidebarHeader>
          <div className="flex items-center space-x-2">
            <Image
              src="/bestcement.webp"
              alt={companyName}
              width={32}
              height={32}
              className="rounded-lg object-cover"
            />
            <div>
              <div className="text-sm font-bold">{companyName}</div>
              <div className="text-xs text-gray-500">{userName}</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarMenu>
            {accessibleMenuItems.map((item: MenuItem) => {
              if (item.items && item.items.length > 0) { // Only render as sub-menu if items exist
                return (
                  <SidebarMenuItem key={item.title}>
                    {item.url ? (
                      <SidebarMenuButton asChild>
                        <a href={item.url} className="py-4 my-2.5">
                          {item.title}
                        </a>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton>{item.title}</SidebarMenuButton>
                    )}
                    <SidebarMenuSub>
                      {item.items.map((subItem: MenuItem) => {
                        if (subItem.items) {
                          // Nested group (Reports / Actionables)
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {subItem.url ? (
                                <SidebarMenuSubButton asChild>
                                  <a href={subItem.url} className="py-5 my-2">
                                    {subItem.title}
                                  </a>
                                </SidebarMenuSubButton>
                              ) : (
                                <SidebarMenuSubButton>{subItem.title}</SidebarMenuSubButton>
                              )}
                              <SidebarMenuSub>
                                {subItem.items.map((subSubItem: MenuItem) => (
                                  <SidebarMenuSubItem key={subSubItem.title}>
                                    <SidebarMenuSubButton asChild>
                                      <a href={subSubItem.url} className="py-6.5 my-2">
                                        {subSubItem.title}
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </SidebarMenuSubItem>
                          );
                        } else {
                          // Direct sub-item link
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {subItem.title === "Logout" ? (
                                <form action="/api/auth/logout" method="post" className="w-full">
                                  <SidebarMenuSubButton asChild>
                                    <button
                                      type="submit"
                                      className="w-full h-full justify-start items-center px-4 py-3 my-1 rounded-md bg-red-600/65 text-white"
                                    >
                                      {subItem.title}
                                    </button>
                                  </SidebarMenuSubButton>
                                </form>
                              ) : (
                                <SidebarMenuSubButton asChild>
                                  <a href={subItem.url} className="py-4 my-1">
                                    {subItem.title}
                                  </a>
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          );
                        }
                      })}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                );
              } else if (item.url) { // Render top-level items that have a URL but no children
                // Top-level without children (e.g., standalone link)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url} className="py-3 my-1">
                        {item.title}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
              return null; // Don't render groups with no URL and no children
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
