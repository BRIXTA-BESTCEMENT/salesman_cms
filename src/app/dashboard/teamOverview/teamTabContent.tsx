// src/app/dashboard/team-overview/teamTabContent.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTableReusable } from '@/components/data-table-reusable';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react'; // Added Icons
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_HIERARCHY } from '@/lib/roleHierarchy';
import TeamEditModal, { TeamMember } from '@/app/dashboard/teamOverview/teamEdit';

const renderSelectFilter = (
  label: string,
  value: string,
  onValueChange: (v: string) => void,
  options: string[],
  isLoading: boolean = false
) => (
  <div className="flex flex-col space-y-1 w-full sm:w-[200px] min-w-[150px]">
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

export function TeamTabContent() {
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const allRoles = ROLE_HIERARCHY;

  // --- API Endpoints ---
  const dataFetchURI = `/api/dashboardPagesAPI/team-overview/dataFetch`;
  const editRoleURI = `/api/dashboardPagesAPI/team-overview/editRole`;
  const editMappingURI = `/api/dashboardPagesAPI/team-overview/editMapping`;
  const editDealerMappingURI = `/api/dashboardPagesAPI/team-overview/editDealerMapping`;
  const editMasonMappingURI = `/api/dashboardPagesAPI/team-overview/editMasonMapping`;
  const currentUserURI = `/api/me`;

  // --- 1. Data Loading ---
  const loadTeamData = useCallback(async (roleOverride?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const roleToUse = roleOverride ?? selectedRole;
      const url = new URL(dataFetchURI, window.location.origin);
      if (roleToUse && roleToUse !== 'all') url.searchParams.append('role', roleToUse);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch team data');
      
      const data: TeamMember[] = await response.json();
      setTeamData(data);
    } catch (err: any) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [dataFetchURI, selectedRole]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch(currentUserURI);
      if (res.ok) {
        const user = await res.json();
        setCurrentUserRole(user.role ?? null);
      }
    } catch (e) {
      console.error('Failed to fetch current user role', e);
    }
  }, [currentUserURI]);

  useEffect(() => {
    fetchCurrentUser();
    loadTeamData();
  }, [fetchCurrentUser, loadTeamData]);


  // --- 2. Action Handlers (Passed to Modal) ---
  const handleSaveRole = useCallback(async (userId: number, newRole: string) => {
    const res = await fetch(editRoleURI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newRole }),
    });
    if (!res.ok) throw new Error('Failed to update role');
    toast.success('User role updated!');
    await loadTeamData();
  }, [editRoleURI, loadTeamData]);

  const handleSaveMapping = useCallback(async (userId: number, reportsToId: number | null, managesIds: number[]) => {
    const res = await fetch(editMappingURI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reportsToId, managesIds }),
    });
    if (!res.ok) throw new Error('Failed to update hierarchy');
    toast.success('Hierarchy updated!');
    await loadTeamData();
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


  // --- 3. Table Configuration ---
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teamData.filter((member) => {
      if (!q) return true;
      return member.name.toLowerCase().includes(q) || member.role.toLowerCase().includes(q);
    });
  }, [teamData, searchQuery]);

  const columns: ColumnDef<TeamMember>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Member Name' },
    { accessorKey: 'role', header: 'Role' },
    { 
      accessorKey: 'managedBy', 
      header: 'Manager',
      cell: ({row}) => row.original.managedBy || <span className="text-muted-foreground italic">None</span>
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


  // --- 4. Render ---
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
        
        {/* --- Filter Components (Updated Style) --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border mb-6">
          
          {/* 1. Search Input */}
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
             <label className="text-sm font-medium text-muted-foreground">Search Team</label>
             <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                   placeholder="Search by name or role..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="pl-8 h-9"
                />
             </div>
          </div>

          {/* 2. Role Filter */}
          {renderSelectFilter(
            'Role',
            selectedRole,
            (val) => { setSelectedRole(val); loadTeamData(val); },
            allRoles,
            isLoading && teamData.length > 0 // Only show spinner in dropdown if refreshing
          )}
        </div>
        {/* --- End Filter Components --- */}

        {/* Table */}
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