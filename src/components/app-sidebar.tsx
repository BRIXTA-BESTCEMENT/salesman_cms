// src/components/app-sidebar.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
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
  SidebarRail,
} from "@/components/ui/sidebar"
import { hasPermission, WorkOSRole, PermPath } from '@/lib/permissions';
import Image from 'next/image';

interface Props {
  userRole: WorkOSRole;
  // ... other props
}

interface CompanyInfo {
  companyName: string;
  adminName: string;
  totalUsers: number;
}

interface MenuItem {
  title: string;
  url?: string;
  permission: PermPath | 'logout' | 'account';
  items?: MenuItem[];
}

// Permission mapping for each menu item
const ITEM_PERMISSIONS = {
  "Home": 'home' as const,
  "CemTem ChatBot": 'cemtemChat' as const,
  "Custom Report Generator": 'customReportGenerator' as const,

  "Business Dashboard": 'dashboard' as const,
  "Team Overview": 'teamOverview.teamTabContent' as const,
  "Users": 'users' as const,
  "Assign Tasks": 'assignTasks' as const,
  "Dealers": 'dealerManagement.listDealers' as const,
  "Technical Sites": 'technicalSites.listSites' as const,
  "Reports": 'reports.dailyVisitReports' as const,
  "Salesman Attendance": 'salesmanAttendance' as const,
  "Salesman Leaves": 'salesmanLeaves' as const,
  "Salesman Geotracking": 'salesmanGeotracking' as const,
  "Permanent Journey Plan": 'permanentJourneyPlan.pjpList' as const,
  "Mason - Petty Contractor": 'masonpcSide.masonpc' as const,
  "Scores And Ratings": 'scoresAndRatings.salesmanRatings' as const,
  "Logistics Gate IO": 'logisticsGateIO.gateIO' as const,

  "Account": 'account' as const,
  "Raise A Querry": 'raiseAQuery' as const,
  "Logout": 'logout' as const,
};

// Define menu items with the new nested structure
const menuItems: MenuItem[] = [
  {
    title: "Home",
    url: "/home",
    permission: ITEM_PERMISSIONS["Home"],
    items: [
      // {
      //   title: "CemTem ChatBot",
      //   url: "/home/cemtemChat",
      //   permission: ITEM_PERMISSIONS["CemTem ChatBot"]
      // },
      {
        title: "Custom Report Generator",
        url: "/home/customReportGenerator",
        permission: ITEM_PERMISSIONS["Custom Report Generator"]
      },
    ],
  },
  {
    title: "Business Dashboard",
    url: "/dashboard",
    permission: ITEM_PERMISSIONS["Business Dashboard"],
    items: [
      {
        title: "Team Overview",
        url: "/dashboard/teamOverview",
        permission: ITEM_PERMISSIONS["Team Overview"]
      },
      {
        title: "Users",
        url: "/dashboard/users",
        permission: ITEM_PERMISSIONS["Users"]
      },
      // {
      //   title: "Assign Tasks",
      //   url: "/dashboard/assignTasks",
      //   permission: ITEM_PERMISSIONS["Assign Tasks"]
      // },
      {
        title: "Dealers",
        url: "/dashboard/dealerManagement",
        permission: ITEM_PERMISSIONS["Dealers"]
      },
      {
        title: "Technical Sites",
        url: "/dashboard/technicalSites",
        permission: ITEM_PERMISSIONS["Technical Sites"]
      },
      {
        title: "Reports",
        url: "/dashboard/reports",
        permission: ITEM_PERMISSIONS["Reports"]
      },
      {
        title: "Permanent Journey Plan",
        url: "/dashboard/permanentJourneyPlan",
        permission: ITEM_PERMISSIONS["Permanent Journey Plan"]
      },
      {
        title: "Salesman Leaves",
        url: "/dashboard/slmLeaves",
        permission: ITEM_PERMISSIONS["Salesman Leaves"]
      },
      {
        title: "Salesman Attendance",
        url: "/dashboard/slmAttendance",
        permission: ITEM_PERMISSIONS["Salesman Attendance"]
      },
      {
        title: "Salesman Geotracking",
        url: "/dashboard/slmGeotracking",
        permission: ITEM_PERMISSIONS["Salesman Geotracking"]
      },
      // {
      //   title: "Scores & Ratings",
      //   url: "/dashboard/scoresAndRatings",
      //   permission: ITEM_PERMISSIONS["Scores And Ratings"]
      // },
      {
        title: "Mason - PC Side",
        url: "/dashboard/masonpcSide",
        permission: ITEM_PERMISSIONS["Mason - Petty Contractor"]
      },
      // {
      //   title: "Logistics Gate IO",
      //   url: "/dashboard/logisticsGateIO",
      //   permission: ITEM_PERMISSIONS["Logistics Gate IO"]
      // },
    ],
  },
  {
    title: "Account",
    url: "/account",
    permission: ITEM_PERMISSIONS["Account"],
    items: [
      // {
      //   title: "Raise A Querry",
      //   url: "/account/query",
      //   permission: ITEM_PERMISSIONS["Raise A Querry"]
      // },
      {
        title: "Logout",
        url: "/account/logout",
        permission: ITEM_PERMISSIONS["Logout"]
      },
    ],
  },
]

export function AppSidebar({ userRole }: Props) {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const apiURI = `/api/company`;

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        setLoading(true);
        const response = await fetch(apiURI);
        const data = await response.json();
        setCompanyInfo(data);
      } catch (error) {
        console.error("Failed to fetch company info", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, []);

  // Recursive function to filter menu items based on user permissions
  const filterMenuItems = (items: MenuItem[], role: WorkOSRole): MenuItem[] => {
    return items.reduce((acc, item) => {
      // Special cases for links that are always visible
      if (item.permission === 'logout' || item.permission === 'account') {
        acc.push(item);
        return acc;
      }

      // Check for sub-items first
      if (item.items) {
        const filteredSubItems = filterMenuItems(item.items, role);
        if (filteredSubItems.length > 0) {
          // If the group has visible children, add the group
          acc.push({ ...item, items: filteredSubItems });
        } else if (item.url && hasPermission(role, item.permission as PermPath)) {
          // If no visible children, check if the main link itself is permitted
          // (e.g., for "Business Dashboard" which links to /dashboard)
          acc.push({ ...item, items: [] }); // Add without children
        }
      }
      // Check for single items (links with no children)
      else if (item.url) {
        if (hasPermission(role, item.permission as PermPath)) {
          acc.push(item);
        }
      }
      return acc;
    }, [] as MenuItem[]);
  };

  const accessibleMenuItems = useMemo(() => {
    // Pass the userRole to the filter function
    return filterMenuItems(menuItems, userRole);
  }, [userRole]);


  return (
    <Sidebar className="hidden md:flex w-64 shrink-0 border-r">
      {/* <SidebarRail className="md:hidden" /> */}

      <SidebarContent>
        <SidebarHeader>
          <div className="flex items-center space-x-2">
            {/*<div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>*/}
            {/* This replaces the <div> with the Building2 icon */}
            <Image
              src="/bestcement.webp"
              alt={companyInfo?.companyName || 'Company Logo'}
              width={32}  // Corresponds to your 'size-8' class (8 * 4px)
              height={32} // Corresponds to your 'size-8' class
              className="rounded-lg object-cover" // Keeps it rounded and ensures the image fills the space
            />
            <div>
              <div className="text-sm font-bold">{companyInfo?.companyName}</div>
              <div className="text-xs text-gray-500">{companyInfo?.adminName}</div>
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
                                <form action="/account/logout" method="post" className="w-full">
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
