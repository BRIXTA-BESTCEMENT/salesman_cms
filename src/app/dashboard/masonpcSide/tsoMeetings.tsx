// src/app/dashboard/masonpcSide/tsoMeetings.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { Search, Loader2, Badge, XCircle, CheckCircle2 } from 'lucide-react';

// Import the reusable DataTable
import { DataTableReusable } from '@/components/data-table-reusable';
// Import the schema for this page
import { tsoMeetingSchema } from '@/lib/shared-zod-schema';

// UI Components for Filtering
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// API Endpoints
const TSO_MEETINGS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/tso-meetings`;
const LOCATION_API_ENDPOINT = `/api/users/user-locations`; 
const ROLES_API_ENDPOINT = `/api/users/user-roles`; 

interface LocationsResponse {
  areas: string[];
  regions: string[];
}
interface RolesResponse {
    roles: string[]; 
}

// Extend the inferred type to include the creator's info needed for filtering.
type TsoMeeting = z.infer<typeof tsoMeetingSchema> & {
    creatorName: string; // Assuming API provides this
    role: string;        // Assuming API provides this
    area: string;        // Assuming API provides this
    region: string;      // Assuming API provides this
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
 * Formats an ISO date string to a more readable format (e.g., "Jan 1, 2024")
 */
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return 'Invalid Date';
  }
};

const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
}

// --- MAIN COMPONENT ---

export default function TsoMeetingsPage() {
  const router = useRouter();
  const [tsoMeetings, setTsoMeetings] = useState<TsoMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState(''); // Creator Name
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
   * Fetches the main TSO meeting data.
   */
  const fetchTsoMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(TSO_MEETINGS_API_ENDPOINT);
      if (!response.ok) {
         if (response.status === 401) {
          toast.error('You are not authenticated. Redirecting to login.');
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          toast.error('You do not have permission to access this page. Redirecting.');
          router.push('/dashboard');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TsoMeeting[] = await response.json();
      setTsoMeetings(data);
      toast.success("TSO meetings loaded successfully!");
    } catch (error: any) {
      console.error("Failed to fetch TSO meetings:", error);
      toast.error(`Failed to fetch TSO meetings: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);


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
      
      const safeAreas = Array.isArray(data.areas) ? data.areas.filter(Boolean) : [];
      const safeRegions = Array.isArray(data.regions) ? data.regions.filter(Boolean) : [];
      
      setAvailableAreas(safeAreas);
      setAvailableRegions(safeRegions);
      
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
      
      const safeRoles = roles.filter(Boolean);
      
      setAvailableRoles(safeRoles);
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
    fetchTsoMeetings();
    fetchLocations();
    fetchRoles();
  }, [fetchTsoMeetings, fetchLocations, fetchRoles]);


  // --- Filtering Logic ---
  const filteredMeetings = useMemo(() => {
    // ⚠️ Removed manual reset of currentPage state
    
    return tsoMeetings.filter((meeting) => {
      // 1. Creator Name Search (fuzzy match)
      const creatorNameMatch = !searchQuery ||
        meeting.creatorName.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Role Filter 
      const roleMatch = roleFilter === 'all' || 
        meeting.role?.toLowerCase() === roleFilter.toLowerCase(); 

      // 3. Area Filter 
      const areaMatch = areaFilter === 'all' || 
        meeting.area?.toLowerCase() === areaFilter.toLowerCase(); 

      // 4. Region Filter 
      const regionMatch = regionFilter === 'all' || 
        meeting.region?.toLowerCase() === regionFilter.toLowerCase();
      
      // Combine all conditions
      return creatorNameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [tsoMeetings, searchQuery, roleFilter, areaFilter, regionFilter]);

  // --- Define Columns for TSO Meeting DataTable (unchanged) ---
  const tsoMeetingColumns: ColumnDef<TsoMeeting>[] = [
    { accessorKey: "creatorName", header: "Creator" },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "type", header: "Type" },
    { 
      accessorKey: "date", 
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date) 
    },
    { accessorKey: "market", header: "Market" },
    { accessorKey: "zone", header: "Zone" },
    { 
      accessorKey: "dealerName", 
      header: "Dealer",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.dealerName || '—'}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">{row.original.dealerAddress}</span>
        </div>
      )
    },
    { accessorKey: "conductedBy", header: "Conducted By" },
    { accessorKey: "participantsCount", header: "Participants" },
    { accessorKey: "giftType", header: "Gift" },
    { accessorKey: "accountJsbJud", header: "Account (JSB/JUD)" },
    { 
      accessorKey: "totalExpenses", 
      header: "Expenses",
      cell: ({ row }) => <span className="font-semibold text-right block">{formatCurrency(row.original.totalExpenses)}</span>
    },
    // {
    //   accessorKey: "billSubmitted",
    //   header: "Bill Submitted",
    //   cell: ({ row }) => (
    //     row.original.billSubmitted ? (
    //       <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
    //         <CheckCircle2 size={12} /> Yes
    //       </Badge>
    //     ) : (
    //       <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
    //         <XCircle size={12} /> No
    //       </Badge>
    //     )
    //   )
    // },
  ];

  const handleTsoMeetingOrderChange = (newOrder: TsoMeeting[]) => {
    console.log("New TSO meeting order:", newOrder.map(r => r.id));
  };

  // --- Loading / Error Gates ---
  if (isLoading) return <div className="flex justify-center items-center min-h-screen">Loading TSO meetings...</div>;

  if (error) return (
    <div className="text-center text-red-500 min-h-screen pt-10">
      Error: {error}
      <Button onClick={fetchTsoMeetings} className="ml-4">Retry</Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="flex-1 space-y-8 p-8 pt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">TSO Meetings</h2>
        </div>

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          {/* 1. Creator Name Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Creator Name</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by creator name..."
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
            <div className="text-center text-gray-500 py-8">No TSO meetings found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={tsoMeetingColumns}
              data={filteredMeetings} 
              enableRowDragging={false} 
              onRowOrderChange={handleTsoMeetingOrderChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}