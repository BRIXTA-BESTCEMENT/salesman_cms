// src/app/dashboard/masonpcSide/masonOnMeetings.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { Search, Loader2 } from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
import { masonsOnMeetingsSchema } from '@/lib/shared-zod-schema';

// UI Components for Filtering
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- CONSTANTS AND TYPES ---

// API Endpoints
const MASON_ON_MEETINGS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/masonOnMeetings`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`; 
const ROLES_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-roles`; 

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
    roles: string[]; 
}

// Type for data coming from the API (based on schema + assumed joins)
type ApiMasonOnMeeting = z.infer<typeof masonsOnMeetingsSchema> & {
    masonName: string;
    meetingType: string;
    salesmanName: string;
    role: string;
    area: string;
    region: string;
};

// Type for data used in the table (must include a unique `id`)
type TableMasonOnMeeting = ApiMasonOnMeeting & {
  id: string; // Add composite ID for the table
};


// --- HELPER FUNCTIONS ---

/**
 * Helper function to render the Select filter component
 */
const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[150px] min-w-[120px]">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
      <SelectTrigger className="h-9">
        {isLoading ? (
          <div className="flex flex-row items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <SelectValue placeholder={`Select ${label}`} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label}s</SelectItem>
        {options.map(option => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/**
 * Formats an ISO date string to a more readable format (e.g., "Jan 1, 2024, 10:30 PM")
 */
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  } catch {
    return 'Invalid Date';
  }
};

// --- MAIN COMPONENT ---

export default function MasonOnMeetingsPage() {
  const [masonOnMeetings, setMasonOnMeetings] = useState<TableMasonOnMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  // --- Filter Options States ---
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  
  const [locationError, setLocationError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);


  // --- Data Fetching Functions ---

  /**
   * Fetches the main Mason on Meetings data.
   */
  const fetchMasonOnMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(MASON_ON_MEETINGS_API_ENDPOINT);
      if (!response.ok) {
         if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          window.location.href = '/login';
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          window.location.href = '/dashboard';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiMasonOnMeeting[] = await response.json();
      
      // Map data to create a unique `id` for the table
      const tableData = data.map(record => ({
        ...record,
        id: `${record.masonId}-${record.meetingId}` // Create a unique composite ID
      }));

      setMasonOnMeetings(tableData);
      toast.success("Mason/Meeting records loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch Mason/Meeting records:", error);
      toast.error(`Failed to fetch Mason/Meeting records: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []); 


  /**
   * Fetches unique areas and regions for the filter dropdowns.
   */
  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    setLocationError(null);
    try {
      const response = await fetch(LOCATION_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: LocationsResponse = await response.json();
      setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean) : []);
      setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean) : []);
    } catch (err: any) {
      console.error('Failed to fetch filter locations:', err);
      setLocationError('Failed to load Area/Region filters.');
      toast.error('Failed to load location filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  /**
   * Fetches unique roles for the filter dropdowns.
   */
  const fetchRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRoleError(null);
    try {
      const response = await fetch(ROLES_API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data: RolesResponse = await response.json(); 
      const roles = data.roles && Array.isArray(data.roles) ? data.roles : [];
      setAvailableRoles(roles.filter(Boolean));
    } catch (err: any) {
      console.error('Failed to fetch filter roles:', err);
      setRoleError('Failed to load Role filters.');
      toast.error('Failed to load role filters.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Initial data loads for reports and filter options
  useEffect(() => {
    fetchMasonOnMeetings();
    fetchLocations();
    fetchRoles();
  }, [fetchMasonOnMeetings, fetchLocations, fetchRoles]);


  // --- Filtering Logic (No Manual Paging) ---
  const filteredMeetings = useMemo(() => {
    return masonOnMeetings.filter((record) => {
      // 1. Mason Name Search
      const nameMatch = !searchQuery ||
        record.masonName.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Role Filter
      const roleMatch = roleFilter === 'all' || 
        record.role?.toLowerCase() === roleFilter.toLowerCase(); 

      // 3. Area Filter
      const areaMatch = areaFilter === 'all' || 
        record.area?.toLowerCase() === areaFilter.toLowerCase(); 

      // 4. Region Filter
      const regionMatch = regionFilter === 'all' || 
        record.region?.toLowerCase() === regionFilter.toLowerCase();
      
      // Combine all conditions
      return nameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [masonOnMeetings, searchQuery, roleFilter, areaFilter, regionFilter]);

  // --- Define Columns for Mason on Meetings DataTable ---
  const masonOnMeetingColumns: ColumnDef<TableMasonOnMeeting>[] = [
    { accessorKey: "masonName", header: "Mason Name" },
    { accessorKey: "meetingType", header: "Meeting Type" },
    { 
      accessorKey: "attendedAt", 
      header: "Attended At",
      cell: ({ row }) => formatDate(row.original.attendedAt)
    },
    { accessorKey: "salesmanName", header: "Associated User" },
    { accessorKey: "role", header: "User Role" },
    { accessorKey: "area", header: "Area" },
    { accessorKey: "region", header: "Region(Zone)" },
  ];

  const handleMasonOnMeetingOrderChange = (newOrder: TableMasonOnMeeting[]) => {
    console.log("New mason-on-meeting order:", newOrder.map(r => r.id));
  };

  // --- Loading / Error Gates ---
  if (isLoading || isLoadingLocations || isLoadingRoles) {
      return <div className="flex justify-center items-center min-h-screen">Loading mason/meeting records...</div>;
  }
  
  if (error || locationError || roleError) {
      return (
          <div className="text-center text-red-500 min-h-screen pt-10">
              Error: {error || locationError || roleError}
              <Button onClick={fetchMasonOnMeetings} className="ml-4">Retry</Button>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Mason on Meetings</h2>
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          {/* 1. Mason Name Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Mason Name</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mason name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* 2. Role Filter */}
          {renderSelectFilter(
            'Role', 
            roleFilter, 
            (v) => { setRoleFilter(v); }, 
            availableRoles, 
            isLoadingRoles
          )}

          {/* 3. Area Filter */}
          {renderSelectFilter(
            'Area', 
            areaFilter, 
            (v) => { setAreaFilter(v); }, 
            availableAreas, 
            isLoadingLocations
          )}

          {/* 4. Region Filter */}
          {renderSelectFilter(
            'Region', 
            regionFilter, 
            (v) => { setRegionFilter(v); }, 
            availableRegions, 
            isLoadingLocations
          )}
          
          {/* Display filter option errors if any */}
          {locationError && <p className="text-xs text-red-500 w-full">Location Filter Error: {locationError}</p>}
          {roleError && <p className="text-xs text-red-500 w-full">Role Filter Error: {roleError}</p>}
        </div>
        {/* --- End Filter Components --- */}

        {/* Data Table Section */}
        <div className="bg-card p-6 rounded-lg border border-border">
          {filteredMeetings.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No mason/meeting records found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={masonOnMeetingColumns}
              data={filteredMeetings}
              enableRowDragging={false} 
              onRowOrderChange={handleMasonOnMeetingOrderChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}