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
  permissions: string[]; // New: ['READ', 'WRITE', 'UPDATE']
}

interface CompanyInfo {
  companyName: string;
  adminName: string;
}

interface MenuItem {
  title: string;
  url?: string;
  requiredPerm?: string | string[] | 'public' | 'logout'; 
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
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Dealers",
        url: "/dashboard/dealerManagement",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Technical Sites",
        url: "/dashboard/technicalSites",
        requiredPerm: ['READ']
      },
      {
        title: "Reports",
        url: "/dashboard/reports",
        requiredPerm: ['READ']
      },
      {
        title: "PJPs (Sales Side)", // Assign Tasks hander
        url: "/dashboard/assignTasks",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "PJPs (Technical Side)", // Permanent Journey Plan handler
        url: "/dashboard/permanentJourneyPlan",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
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
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
      {
        title: "Logistics IO",
        url: "/dashboard/logisticsIO",
        requiredPerm: ['READ', 'WRITE', 'UPDATE']
      },
    ],
  },
  {
    title: "Account",
    url: "/account",
    requiredPerm: 'public',
    items: [
      {
        title: "Logout",
        url: "/account/logout",
        requiredPerm: ['logout']
      },
    ],
  },
]

export function AppSidebar({ userRole, permissions = [] }: Props) {
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

  // Filter based on the 'permissions' array from the DB
  const filterItems = useCallback((items: MenuItem[]): MenuItem[] => {
    
    if (!permissions) return [];

    return items.reduce((acc, item) => {
      const { requiredPerm } = item;

      // 1. Handle Public/Special items
      if (!requiredPerm || requiredPerm === 'public' || requiredPerm === 'logout') {
        acc.push(item.items ? { ...item, items: filterItems(item.items) } : item);
        return acc;
      }

      // 2. Handle Multiple Permissions (Check if user has ALL)
      const requiredArray = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
      
      // Now 'permissions' is correctly scoped from the props
      const hasAllAccess = requiredArray.every(p => permissions.includes(p));

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
