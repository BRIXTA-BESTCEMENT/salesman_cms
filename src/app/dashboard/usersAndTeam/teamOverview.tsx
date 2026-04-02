// src/app/dashboard/team-overview/teamOverview.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTableReusable } from '@/components/data-table-reusable';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { useDebounce } from '@/hooks/use-debounce-search';
import TeamEditModal, { TeamMember } from '@/app/dashboard/usersAndTeam/teamEdit';

interface TeamOverviewProps {
  currentUserRole: string | null;
}

export function TeamOverview({ currentUserRole }: TeamOverviewProps) {
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [roleFilter, setRoleFilter] = useState('all');
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);

  // --- API Endpoints ---
  const dataFetchURI = `/api/dashboardPagesAPI/users-and-team/team-overview/dataFetch`;
  const editRoleURI = `/api/dashboardPagesAPI/users-and-team/team-overview/editRole`;
  const editMappingURI = `/api/dashboardPagesAPI/users-and-team/team-overview/editMapping`;
  const editDealerMappingURI = `/api/dashboardPagesAPI/users-and-team/team-overview/editDealerMapping`;
  const editMasonMappingURI = `/api/dashboardPagesAPI/users-and-team/team-overview/editMasonMapping`;

  // --- 1. Data Loading ---
  const loadTeamData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetching all data so we can filter smoothly on the client side
      const url = new URL(dataFetchURI, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const data: TeamMember[] = await response.json();
      setTeamData(data);
    } catch (err: any) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [dataFetchURI]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);


  // --- 2. Action Handlers (Passed to Modal) ---
  const handleSaveRole = useCallback(async (userId: number, newOrgRole: string, newJobRoles: string[]) => {
    const res = await fetch(editRoleURI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newOrgRole, newJobRoles }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update roles');
    }
    toast.success('User roles updated!');
    await loadTeamData();
  }, [editRoleURI, loadTeamData]);

  const handleSaveMapping = useCallback(async (userId: number, reportsToId: number | null, managesIds: number[]) => {
    try {
      const res = await fetch(editMappingURI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reportsToId, managesIds }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update hierarchy');
      }

      toast.success('Hierarchy updated!');
      await loadTeamData();
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  }, [editMappingURI, loadTeamData]);

  const handleSaveDealerMapping = useCallback(async (userId: number, dealerIds: string[]) => {
    const res = await fetch(editDealerMappingURI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dealerIds }),
    });
    if (!res.ok) throw new Error('Failed to update dealer mapping');
    toast.success('Dealer mapping updated!');
    await loadTeamData();
  }, [editDealerMappingURI, loadTeamData]);

  const handleSaveMasonMapping = useCallback(async (userId: number, masonIds: string[]) => {
    const res = await fetch(editMasonMappingURI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, masonIds }),
    });
    if (!res.ok) throw new Error('Failed to update mason mapping');
    toast.success('Mason mapping updated!');
    await loadTeamData();
  }, [editMasonMappingURI, loadTeamData]);


  // --- 3. Derived Options for Filters (Memoized) ---
  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    teamData.forEach(member => { if (member.orgRole) roles.add(member.orgRole); });
    return [
      { label: 'All Roles', value: 'all' },
      ...Array.from(roles).sort().map(r => ({ label: r.replace(/-/g, ' '), value: r }))
    ];
  }, [teamData]);

  const zoneOptions = useMemo(() => {
    const regions = new Set<string>();
    // Note: Assuming TeamMember has a 'region' field. If it's named differently, update here.
    teamData.forEach(member => { if ((member as any).region) regions.add((member as any).region); });
    return Array.from(regions).sort().map(r => ({ label: r, value: r }));
  }, [teamData]);

  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    // Note: Assuming TeamMember has an 'area' field.
    teamData.forEach(member => { if ((member as any).area) areas.add((member as any).area); });
    return Array.from(areas).sort().map(a => ({ label: a, value: a }));
  }, [teamData]);

  // --- 4. Client Side Filtering Logic ---
  const filteredData = useMemo(() => {
    return teamData.filter(member => {
      const fullName = (member.name || '').toLowerCase();
      const search = debouncedSearch.toLowerCase();
      const matchesSearch = !debouncedSearch || fullName.includes(search);

      const matchesRole = roleFilter === 'all' || member.orgRole === roleFilter;

      // Defensively checking region/area in case TeamMember doesn't expose them cleanly
      const memberRegion = (member as any).region;
      const memberArea = (member as any).area;

      const matchesZone = zoneFilters.length === 0 || (memberRegion && zoneFilters.includes(memberRegion));
      const matchesArea = areaFilters.length === 0 || (memberArea && areaFilters.includes(memberArea));

      return matchesSearch && matchesRole && matchesZone && matchesArea;
    });
  }, [teamData, debouncedSearch, roleFilter, zoneFilters, areaFilters]);


  // --- 5. Column Definitions ---
  const columns: ColumnDef<TeamMember>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Member Name' },
    {
      accessorKey: 'orgRole',
      header: 'Role',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.orgRole}</span>
          {row.original.jobRole && row.original.jobRole.length > 0 && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {row.original.jobRole.join(', ')}
            </span>
          )}
        </div>
      )
    },
    {
      accessorKey: 'managedBy',
      header: 'Manager',
      cell: ({ row }) => row.original.managedBy || <span className="text-muted-foreground italic">None</span>
    },
    {
      header: 'Reports To',
      cell: ({ row }) => {
        const count = row.original.managesReports.length;
        return <span className="font-medium">{count}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TeamEditModal
          member={row.original}
          allTeamMembers={teamData}
          currentUserRole={currentUserRole}
          onSaveRole={handleSaveRole}
          onSaveMapping={handleSaveMapping}
          onSaveDealerMapping={handleSaveDealerMapping}
          onSaveMasonMapping={handleSaveMasonMapping}
        />
      ),
    },
  ], [teamData, currentUserRole, handleSaveRole, handleSaveMapping, handleSaveDealerMapping, handleSaveMasonMapping]);


  // --- 6. Render ---
  if (isLoading && teamData.length === 0) {
    return (
      <Card className="border border-border/30 bg-card/50 backdrop-blur-lg">
        <CardContent className="py-8 text-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading team data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/30 bg-card/50 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Team Hierarchy & Overview</CardTitle>
      </CardHeader>
      <CardContent>

        {/* --- Unified Global Filter Bar --- */}
        <GlobalFilterBar
          showSearch={true}
          showRole={true}
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          searchVal={searchQuery}
          roleVal={roleFilter}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          roleOptions={roleOptions}
          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onRoleChange={setRoleFilter}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />

        {/* --- Data Table --- */}
        {error ? (
          <div className="text-center text-red-500 py-8">Error: {error}</div>
        ) : filteredData.length === 0 ? (
          <div className="text-center text-neutral-500 py-8">No team members found.</div>
        ) : (
          <DataTableReusable
            columns={columns}
            data={filteredData}
          />
        )}
      </CardContent>
    </Card>
  );
}