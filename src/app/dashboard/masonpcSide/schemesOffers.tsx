// src/app/dashboard/masonpcSide/schemesOffers.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';
import { Search, Loader2, IndianRupee, Eye } from 'lucide-react';

// Reusable Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search'; 

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AddSchemesRewards } from '@/app/dashboard/masonpcSide/add-schemes-rewards';
import { selectSchemesOffersSchema } from '../../../../drizzle/zodSchemas';

// Types
type RewardRecord = {
  id: number;
  name: string;
  pointCost: number;
  stock: number;
  isActive: boolean;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
  schemeIds: string[];
};

type SchemeOffer = z.infer<typeof selectSchemesOffersSchema>;
type CategoryOption = { id: number; name: string; };

// API Endpoints
const REWARDS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/rewards`;
const CATEGORIES_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/reward-categories`;
const SCHEMES_OFFERS_API_ENDPOINT = `/api/dashboardPagesAPI/masonpc-side/schemes-offers`;

export default function SchemesRewardsManagement() {
  // --- State ---
  const [schemes, setSchemes] = useState<SchemeOffer[]>([]);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SchemeOffer | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [schemeSearch, setSchemeSearch] = useState('');
  const debouncedSchemeSearch = useDebounce(schemeSearch, 500);

  const [rewardSearch, setRewardSearch] = useState('');
  const debouncedRewardSearch = useDebounce(rewardSearch, 500);
  
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Fetching Logic ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [schemesRes, rewardsRes, categoriesRes] = await Promise.all([
        fetch(SCHEMES_OFFERS_API_ENDPOINT),
        fetch(REWARDS_API_ENDPOINT),
        fetch(CATEGORIES_API_ENDPOINT)
      ]);

      if (!schemesRes.ok || !rewardsRes.ok) throw new Error("Failed to load data");

      const schemesData = await schemesRes.json();
      const rewardsData = await rewardsRes.json();
      const categoriesData = await categoriesRes.json();

      setSchemes(schemesData);
      setRewards(rewardsData);
      setCategories(categoriesData.filter((c: any) => c.name));
    } catch (err: any) {
      setError(err.message);
      toast.error("Error syncing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Helpers ---
  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
  };

  const getRewardStatus = (isActive: boolean, stock: number) => {
    if (!isActive) return { text: 'Inactive', color: 'bg-gray-100 text-gray-700' };
    if (stock <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-700' };
    if (stock < 5) return { text: 'Low Stock', color: 'bg-orange-100 text-orange-700' };
    return { text: 'Active', color: 'bg-green-100 text-green-700' };
  };

  // --- Mapped Options for Filter Bar ---
  const categoryOptions = useMemo(() => [
    { label: 'All Categories', value: 'all' },
    ...categories.map(c => ({ label: c.name, value: c.name }))
  ], [categories]);

  const statusOptions = useMemo(() => [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
    { label: 'Low Stock', value: 'Low Stock' },
    { label: 'Out of Stock', value: 'Out of Stock' }
  ], []);

  // --- Memoized Filtered Data ---
  const filteredSchemes = useMemo(() => {
    return schemes.filter(s => s.name.toLowerCase().includes(debouncedSchemeSearch.toLowerCase()));
  }, [schemes, debouncedSchemeSearch]);

  const filteredRewards = useMemo(() => {
    const search = debouncedRewardSearch.toLowerCase();
    return rewards.filter(r => {
      const matchesScheme = !selectedScheme || (r.schemeIds && r.schemeIds.some(id => id.toLowerCase() === selectedScheme.id.toLowerCase()));
      const matchesSearch = !search || r.name.toLowerCase().includes(search);
      const matchesCategory = categoryFilter === 'all' || r.categoryName === categoryFilter;
      const statusData = getRewardStatus(r.isActive, r.stock);
      const matchesStatus = statusFilter === 'all' || statusData.text === statusFilter;

      return matchesScheme && matchesSearch && matchesCategory && matchesStatus;
    });
  }, [rewards, debouncedRewardSearch, categoryFilter, statusFilter, selectedScheme]);

  // --- Column Definitions ---
  const schemeColumns: ColumnDef<SchemeOffer>[] = [
    { accessorKey: "name", header: "Scheme Name" },
    { accessorKey: "startDate", header: "Start", cell: ({ row }) => formatDate(row.original.startDate) },
    { accessorKey: "endDate", header: "End", cell: ({ row }) => formatDate(row.original.endDate) },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const isCurrentlySelected = selectedScheme?.id === row.original.id;
        return (
          <Button
            variant={isCurrentlySelected ? "default" : "outline"}
            size="sm"
            className={isCurrentlySelected ? "bg-[#facc15] text-black hover:bg-[#eab308]" : ""}
            onClick={() => setSelectedScheme(isCurrentlySelected ? null : row.original)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {isCurrentlySelected ? "Viewing" : "View Rewards"}
          </Button>
        );
      }
    }
  ];

  const rewardColumns: ColumnDef<RewardRecord>[] = [
    { accessorKey: "name", header: "Reward Name", enableSorting: true },
    {
      accessorKey: "categoryName",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {row.original.categoryName}
        </Badge>
      )
    },
    {
      accessorKey: "pointCost",
      header: "Point Cost",
      cell: ({ row }) => (
        <div className='flex items-center text-primary font-semibold'>
          {row.original.pointCost} <IndianRupee className='w-3 h-3 ml-1' />
        </div>
      ),
      enableSorting: true,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = getRewardStatus(row.original.isActive, row.original.stock);
        return <Badge variant="outline" className={`${status.color} shadow-none border-0`}>{status.text}</Badge>
      }
    },
    { accessorKey: "createdAt", header: "Created On", cell: ({ row }) => formatDate(row.original.createdAt) },
  ];

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );

  return (
    <div className="flex flex-col space-y-6 p-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Marketing & Rewards</h1>
          <p className="text-muted-foreground">Manage schemes and their associated reward items</p>
        </div>
        <AddSchemesRewards onSuccess={fetchData} />
      </div>

      {/* Top Table: Schemes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Active Schemes & Offers</CardTitle>
              <CardDescription>Select a scheme to filter rewards below</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schemes..."
                className="pl-8"
                value={schemeSearch}
                onChange={(e) => setSchemeSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTableReusable columns={schemeColumns} data={filteredSchemes} />
        </CardContent>
      </Card>

      {/* Bottom Table: Rewards */}
      {selectedScheme && (
        <Card className={selectedScheme ? "border-primary/50 shadow-md" : ""}>
          <CardHeader className="pb-3 border-b mb-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedScheme ? (
                    <>Viewing Rewards for: <Badge className="text-lg px-3">{selectedScheme.name}</Badge></>
                  ) : "All Available Rewards"}
                </CardTitle>
                {selectedScheme && (
                  <Button variant="link" className="p-0 h-auto text-xs" onClick={() => setSelectedScheme(null)}>
                    Clear selection to see all rewards
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            
            <div className="mb-4">
              <GlobalFilterBar 
                showSearch={true}
                showRole={true} // Used for Category
                showStatus={true}
                showDateRange={false}
                showZone={false}
                showArea={false}

                searchVal={rewardSearch}
                roleVal={categoryFilter}
                statusVal={statusFilter}

                roleOptions={categoryOptions}
                statusOptions={statusOptions}

                onSearchChange={setRewardSearch}
                onRoleChange={setCategoryFilter}
                onStatusChange={setStatusFilter}
              />
            </div>

            <DataTableReusable columns={rewardColumns} data={filteredRewards} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}