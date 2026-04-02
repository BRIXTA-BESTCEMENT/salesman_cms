// src/app/dashboard/masonpcSide/tsoMeetings.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import {
  Loader2, Eye, User, Calendar, MapPin, Store, Users, ExternalLink,
  Wallet, Gift, Camera, Image as ImageIcon
} from 'lucide-react';

// Import standard components
import { DataTableReusable } from '@/components/data-table-reusable';
import { RefreshDataButton } from '@/components/RefreshDataButton';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';   

// UI Components
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// API Endpoints
const TSO_MEETINGS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/tso-meetings`;
const LOCATION_API_ENDPOINT = `/api/dashboardPagesAPI/users-and-team/users/user-locations`;

import { selectTsoMeetingSchema } from '../../../../drizzle/zodSchemas';

interface LocationsResponse {
  areas: string[];
  regions: string[];
}

const extendedMeetingSchema = selectTsoMeetingSchema.loose().extend({
  creatorName: z.string(),
  area: z.string(),
  region: z.string(),
  meetImageUrl: z.string().nullable().optional(),
  totalExpenses: z.number().nullable().optional()
});

type TsoMeeting = z.infer<typeof extendedMeetingSchema>;

// --- CONSTANTS ---
const MEETING_TYPES = [
  'Retailer Meet',
  'Mason Meet',
  'Architect Meet',
  'Contractor Meet',
  'Engineer Meet'
];

// --- HELPER FUNCTIONS ---
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

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (isNaN(numericValue)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

// --- REUSABLE READ-ONLY FIELD ---
const InfoField = ({ label, value, icon: Icon, fullWidth = false }: { label: string, value: React.ReactNode, icon?: any, fullWidth?: boolean }) => (
  <div className={`flex flex-col space-y-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </Label>
    <div className="text-sm font-medium p-2 bg-secondary/20 rounded-md border border-border/50 min-h-9 flex items-center">
      {value || <span className="text-muted-foreground italic text-xs">N/A</span>}
    </div>
  </div>
);

// --- MAIN COMPONENT ---
export default function TsoMeetingsPage() {
  const router = useRouter();
  const [tsoMeetings, setTsoMeetings] = useState<TsoMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize] = useState(500);
  const [totalCount, setTotalCount] = useState(0);

  // --- Modal State ---
  const [selectedReport, setSelectedReport] = useState<TsoMeeting | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // --- Backend Filter Options ---
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery, areaFilters, zoneFilters,]);

  // --- Data Fetching Functions ---
  const fetchTsoMeetings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(TSO_MEETINGS_API_ENDPOINT, window.location.origin);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('pageSize', pageSize.toString());

      if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
      
      // Join arrays for multi-select
      if (areaFilters.length > 0) url.searchParams.append('area', areaFilters.join(','));
      if (zoneFilters.length > 0) url.searchParams.append('region', zoneFilters.join(','));

      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const result = await response.json();
      const rawData = result.data || result;
      setTotalCount(result.totalCount || 0);

      const validatedData = rawData.map((item: any) => {
          const v = extendedMeetingSchema.parse(item);
          return { ...v, id: v.id.toString() } as TsoMeeting;
      });

      setTsoMeetings(validatedData);
      toast.success("TSO meetings loaded successfully!");
    } catch (error: any) {
      toast.error(`Failed to fetch TSO meetings: ${error.message}`);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [router, page, pageSize, debouncedSearchQuery, areaFilters, zoneFilters]);

  const fetchLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const url = new URL(LOCATION_API_ENDPOINT, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data: LocationsResponse = await response.json();
        setAvailableAreas(Array.isArray(data.areas) ? data.areas.filter(Boolean) : []);
        setAvailableRegions(Array.isArray(data.regions) ? data.regions.filter(Boolean) : []);
      }
    } catch (err: any) {
      setLocationError('Failed to load Area/Region filters.');
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchTsoMeetings();
  }, [fetchTsoMeetings]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const zoneOptions = useMemo(() => availableRegions.sort().map(r => ({ label: r, value: r })), [availableRegions]);
  const areaOptions = useMemo(() => availableAreas.sort().map(a => ({ label: a, value: a })), [availableAreas]);

  // --- Define Columns ---
  const tsoMeetingColumns = useMemo<ColumnDef<TsoMeeting>[]>(() => [
    { accessorKey: "creatorName", header: "Creator" },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline" className="shadow-none">{row.original.type}</Badge>
    },
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
    { accessorKey: "participantsCount", header: "Participants" },
    {
      accessorKey: "totalExpenses",
      header: () => <div className="text-right">Expenses</div>,
      cell: ({ row }) => <span className="font-semibold text-right block">{formatCurrency(row.original.totalExpenses)}</span>
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 h-8 px-2 shadow-sm"
          onClick={() => {
            setSelectedReport(row.original);
            setIsViewModalOpen(true);
          }}
        >
          <Eye className="h-3.5 w-3.5 mr-1" /> View
        </Button>
      ),
    },
  ], []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 w-full">
        
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
             <h2 className="text-3xl font-bold tracking-tight">TSO Meetings</h2>
             <Badge variant="outline" className="text-base px-4 py-1">
                 Total Meetings: {totalCount}
             </Badge>
          </div>
          <RefreshDataButton
            cachePrefix="tso-meetings"
            onRefresh={fetchTsoMeetings}
          />
        </div>

        {/* --- Unified Global Filter Bar --- */}
        <div className="w-full">
          <GlobalFilterBar 
            showSearch={true}
            showRole={false} 
            showZone={true}
            showArea={true}
            showDateRange={false}
            showStatus={false}

            searchVal={searchQuery}
            zoneVals={zoneFilters}
            areaVals={areaFilters}

            zoneOptions={zoneOptions}
            areaOptions={areaOptions}

            onSearchChange={setSearchQuery}
            onZoneChange={setZoneFilters}
            onAreaChange={setAreaFilters}
          />
        </div>

        {locationError && <p className="text-xs text-red-500 w-full mt-2 italic">Location Filter Error: {locationError}</p>}

        {/* Data Table Section */}
        <div className="bg-card p-1 rounded-lg border border-border shadow-sm">
          {isLoading && tsoMeetings.length === 0 ? (
             <div className="flex justify-center items-center h-64">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : error ? (
            <div className="text-center text-red-500 min-h-64 flex flex-col items-center justify-center">
              <p>Error: {error}</p>
              <Button onClick={fetchTsoMeetings} className="mt-4">Retry</Button>
            </div>
          ) : tsoMeetings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No TSO meetings found matching the selected filters.</div>
          ) : (
            <DataTableReusable
              columns={tsoMeetingColumns}
              data={tsoMeetings}
              enableRowDragging={false}
            />
          )}
        </div>
      </div>

      {/* --- SMART DETAILS MODAL --- */}
      {selectedReport && (
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background">

            <div className="px-6 py-4 border-b bg-muted/20 border-l-[6px] border-l-indigo-500">
              <DialogTitle className="text-xl flex items-center justify-between">
                <span>Meeting Details</span>
                <Badge variant="default" className="text-sm px-3 bg-indigo-600 hover:bg-indigo-700">
                  {selectedReport.type}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {selectedReport.creatorName}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(selectedReport.date)}</span>
              </DialogDescription>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-full border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 pt-2">
                    <InfoField label="Zone" value={selectedReport.zone} />
                    <InfoField label="Market" value={selectedReport.market} />
                    <InfoField label="Conducted By" value={selectedReport.conductedBy} fullWidth />
                  </CardContent>
                </Card>

                <Card className="h-full border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Store className="w-4 h-4" /> Dealer Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 pt-2">
                    <InfoField label="Dealer Name" value={selectedReport.dealerName} />
                    <InfoField label="Dealer Address" value={selectedReport.dealerAddress} />
                  </CardContent>
                </Card>
              </div>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Metrics & Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  <InfoField label="Participants" value={selectedReport.participantsCount} icon={Users} />
                  <InfoField label="Gift Type" value={selectedReport.giftType} icon={Gift} />
                  <InfoField label="Account" value={selectedReport.accountJsbJud} />

                  <div className="flex flex-col space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Total Expenses</Label>
                    <div className="text-sm font-bold p-2 text-foreground bg-muted/50 rounded-md border flex items-center">
                      {formatCurrency(selectedReport.totalExpenses)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Meeting Photo Evidence
                </h4>

                <div className="flex flex-col gap-6">
                  {selectedReport.meetImageUrl ? (
                    <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                      <div className="bg-muted px-4 py-2 text-sm font-semibold border-b flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> Uploaded Image
                        </span>
                      </div>
                      <a href={selectedReport.meetImageUrl} target="_blank" rel="noreferrer" className="block relative group">
                        <img
                          src={selectedReport.meetImageUrl}
                          className="w-full h-auto max-h-[500px] object-contain bg-black/5"
                          alt="Meeting Evidence"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <ExternalLink className="text-white w-5 h-5" />
                          <span className="text-white font-medium text-sm">Click to View Full Image</span>
                        </div>
                      </a>
                    </div>
                  ) : (
                    <div className="border rounded-lg h-32 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground text-sm italic border-dashed">
                      <Camera className="w-8 h-8 mb-2 opacity-20" />
                      No Photo Uploaded
                    </div>
                  )}
                </div>
              </div>

            </div>

            <DialogFooter className="p-4 bg-background border-t">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close Window</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}