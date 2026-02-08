// src/app/dashboard/team-overview/teamEdit.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Loader2, PencilIcon, StoreIcon, UsersIcon, ShieldCheck, Trash2
} from 'lucide-react'; // Added Trash2
import { toast } from 'sonner';

// Shared Components
import { MultiSelect } from '@/components/multi-select';
import { useDealerLocations } from '@/components/reusable-dealer-locations';
import { ROLE_HIERARCHY, canAssignRole } from '@/lib/roleHierarchy';

// --- TYPES ---
export interface TeamMember {
  id: number;
  name: string;
  role: string;
  managedBy: string | null;
  manages: string;
  managedById: number | null;
  managesIds: number[];
  managesReports: { name: string; role: string }[];
  area?: string | null;
  region?: string | null;
  isTechnicalRole: boolean;
}

interface TeamEditProps {
  member: TeamMember;
  allTeamMembers: TeamMember[];
  currentUserRole: string | null;
  onSaveRole: (userId: number, newRole: string) => Promise<void>;
  onSaveMapping: (userId: number, reportsToId: number | null, managesIds: number[]) => Promise<void>;
  onSaveDealerMapping: (userId: number, dealerIds: string[]) => Promise<void>;
  onSaveMasonMapping: (userId: number, masonIds: string[]) => Promise<void>;
}

const allRoles = ROLE_HIERARCHY;

// --- SUB-COMPONENTS FOR TABS ---

// 1. Role Tab
const RoleTab = ({ member, currentUserRole, onSave }: { member: TeamMember, currentUserRole: string | null, onSave: any }) => {
  const [newRole, setNewRole] = useState(member.role);
  const [isSaving, setIsSaving] = useState(false);

  const assignableRoles = useMemo(() => {
    if (!currentUserRole) return [];
    return allRoles.filter((r) => canAssignRole(currentUserRole, r));
  }, [currentUserRole]);

  const rolesToShow = useMemo(() => {
    const set = new Set<string>();
    if (member.role) set.add(member.role);
    assignableRoles.forEach(r => set.add(r));
    return Array.from(set);
  }, [assignableRoles, member.role]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(member.id, newRole);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false); // This will ALWAYS run
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Assign Role</label>
        <Select value={newRole} onValueChange={setNewRole}>
          <SelectTrigger>
            <SelectValue placeholder="Select Role" />
          </SelectTrigger>
          <SelectContent>
            {rolesToShow.map((role) => (
              <SelectItem key={role} value={role}>{role}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSave} disabled={newRole === member.role || isSaving} className="w-full">
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Role
      </Button>
    </div>
  );
};

// 2. Hierarchy Tab
const HierarchyTab = ({ member, allTeamMembers, currentUserRole, onSave }: { member: TeamMember, allTeamMembers: TeamMember[], currentUserRole: string | null, onSave: any }) => {
  const [newReportsToId, setNewReportsToId] = useState<number | null>(member.managedById);
  const [newManagesIds, setNewManagesIds] = useState<number[]>(member.managesIds ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const memberIndex = allRoles.indexOf(member.role);

  const managerOptions = useMemo(() => {
    if (!currentUserRole || memberIndex === -1) return [];
    return allTeamMembers
      .filter((m) => m.id !== member.id)
      .filter((m) => {
        const idx = allRoles.indexOf(m.role);
        return idx !== -1 && idx < memberIndex && canAssignRole(currentUserRole, m.role);
      })
      .map((m) => ({ value: m.id.toString(), label: `${m.name} (${m.role})` }));
  }, [allTeamMembers, memberIndex, member.id, currentUserRole]);

  const juniorOptions = useMemo(() => {
    if (!currentUserRole || memberIndex === -1) return [];
    return allTeamMembers
      .filter((m) => m.id !== member.id)
      .filter((m) => {
        const idx = allRoles.indexOf(m.role);
        return idx !== -1 && idx > memberIndex && canAssignRole(currentUserRole, m.role);
      })
      .map((m) => ({ value: m.id.toString(), label: `${m.name} (${m.role})` }));
  }, [allTeamMembers, memberIndex, member.id, currentUserRole]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(member.id, newReportsToId, newManagesIds);
    setIsSaving(false);
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Reports To (Manager)</label>
        <Select
          value={newReportsToId?.toString() ?? 'none'}
          onValueChange={(val) => setNewReportsToId(val === 'none' ? null : Number(val))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {managerOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Manages (Subordinates)</label>
        <MultiSelect
          options={juniorOptions}
          selectedValues={newManagesIds.map(String)}
          onValueChange={(vals) => setNewManagesIds(vals.map(Number))}
          placeholder="Select Juniors..."
        />
      </div>
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Hierarchy
      </Button>
    </div>
  );
};

// 3. Dealer/Mason Filter Helper Component
const LocationFilter = ({
  areas, regions, selectedArea, selectedRegion, onAreaChange, onRegionChange, onClear
}: any) => (
  <div className="flex flex-col gap-2 mb-4 p-3 bg-muted/30 rounded-lg border">
    <div className="flex gap-2">
      <Select value={selectedArea ?? "all"} onValueChange={(v) => onAreaChange(v === "all" ? null : v)}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Filter Area" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Areas</SelectItem>
          {areas.sort().map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={selectedRegion ?? "all"} onValueChange={(v) => onRegionChange(v === "all" ? null : v)}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Filter Region" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {regions.sort().map((r: string) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={onClear} disabled={!selectedArea && !selectedRegion} className="h-6 text-xs">
        Clear Filters
      </Button>
    </div>
  </div>
);

// 4. Dealer Tab
const DealerTab = ({ member, onSave }: { member: TeamMember, onSave: any }) => {
  const [selectedDealerIds, setSelectedDealerIds] = useState<string[]>([]);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { locations, loading: locLoading } = useDealerLocations();
  const [area, setArea] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    if (locLoading) return;
    (async () => {
      setLoading(true);
      try {
        const url = new URL(`/api/dashboardPagesAPI/users-and-team/team-overview/editDealerMapping`, window.location.origin);
        url.searchParams.append('userId', String(member.id));
        if (area) url.searchParams.append('area', area);
        if (region) url.searchParams.append('region', region);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setOptions(data.dealers.map((d: any) => ({ value: d.id, label: d.name })));
          if (!area && !region) setSelectedDealerIds(data.assignedDealerIds ?? []);
        }
      } catch (e) { toast.error("Failed to load dealers"); }
      finally { setLoading(false); }
    })();
  }, [member.id, area, region, locLoading]);

  // Handler to clear selections locally
  const handleUnassignAll = () => {
    setSelectedDealerIds([]);
  };

  return (
    <div className="space-y-4 py-4">
      <LocationFilter
        areas={locations.areas} regions={locations.regions}
        selectedArea={area} selectedRegion={region}
        onAreaChange={setArea} onRegionChange={setRegion}
        onClear={() => { setArea(null); setRegion(null); }}
      />
      {loading ? <div className="text-center py-4 text-muted-foreground">Loading...</div> : (
        <MultiSelect
          options={options}
          selectedValues={selectedDealerIds}
          onValueChange={setSelectedDealerIds}
          placeholder="Select Dealers..."
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Unassign Button */}
        <Button
          variant="outline"
          onClick={handleUnassignAll}
          disabled={isSaving || selectedDealerIds.length === 0}
          className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Unassign All
        </Button>

        {/* Save Button */}
        <Button
          onClick={async () => {
            setIsSaving(true);
            try {
              await onSave(member.id, selectedDealerIds);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
          className="w-full flex-1"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Dealers
        </Button>
      </div>
    </div>
  );
};

// 5. Mason Tab
const MasonTab = ({ member, onSave }: { member: TeamMember, onSave: any }) => {
  if (!member.isTechnicalRole) return <div className="py-8 text-center text-muted-foreground">This user is not in a technical role.</div>;

  const [selectedMasonIds, setSelectedMasonIds] = useState<string[]>([]);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { locations, loading: locLoading } = useDealerLocations();
  const [area, setArea] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    if (locLoading) return;
    (async () => {
      setLoading(true);
      try {
        const url = new URL(`/api/dashboardPagesAPI/users-and-team/team-overview/editMasonMapping`, window.location.origin);
        url.searchParams.append('userId', String(member.id));
        if (area) url.searchParams.append('area', area);
        if (region) url.searchParams.append('region', region);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setOptions(data.masons.map((m: any) => ({
            value: m.id,
            label: `${m.name} (${m.dealer?.name || 'No Dealer'})`
          })));
          if (!area && !region) setSelectedMasonIds(data.assignedMasonIds ?? []);
        }
      } catch (e) { toast.error("Failed to load masons"); }
      finally { setLoading(false); }
    })();
  }, [member.id, area, region, locLoading]);

  // Handler to clear selections locally
  const handleUnassignAll = () => {
    setSelectedMasonIds([]);
  };

  return (
    <div className="space-y-4 py-4">
      <LocationFilter
        areas={locations.areas} regions={locations.regions}
        selectedArea={area} selectedRegion={region}
        onAreaChange={setArea} onRegionChange={setRegion}
        onClear={() => { setArea(null); setRegion(null); }}
      />
      {loading ? <div className="text-center py-4 text-muted-foreground">Loading...</div> : (
        <MultiSelect
          options={options}
          selectedValues={selectedMasonIds}
          onValueChange={setSelectedMasonIds}
          placeholder="Select Masons..."
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Unassign Button */}
        <Button
          variant="outline"
          onClick={handleUnassignAll}
          disabled={isSaving || selectedMasonIds.length === 0}
          className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Unassign All
        </Button>

        {/* Save Button */}
        <Button
          onClick={async () => {
            setIsSaving(true);
            try {
              await onSave(member.id, selectedMasonIds);
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
          className="w-full flex-1"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Masons
        </Button>
      </div>
    </div>
  );
};


// --- MAIN EXPORT COMPONENT ---
export default function TeamEditModal({
  member, allTeamMembers, currentUserRole, onSaveRole, onSaveMapping, onSaveDealerMapping, onSaveMasonMapping
}: TeamEditProps) {
  const [isOpen, setIsOpen] = useState(false);

  // If user cannot edit, don't show button (or show disabled)
  if (!currentUserRole) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-500 border-blue-500 hover:bg-blue-50"
        >
          <PencilIcon className="w-4 h-4 mr-2" />
          View & Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage: {member.name}</DialogTitle>
          <DialogDescription>
            Current Role: <span className="font-semibold text-foreground">{member.role}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="role" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="role" className="flex gap-2"><ShieldCheck className="w-4 h-4" /> Role</TabsTrigger>
            <TabsTrigger value="hierarchy" className="flex gap-2"><UsersIcon className="w-4 h-4" /> Hierarchy</TabsTrigger>
            <TabsTrigger value="dealers" className="flex gap-2"><StoreIcon className="w-4 h-4" /> Dealers</TabsTrigger>
            <TabsTrigger value="masons" className="flex gap-2"><PencilIcon className="w-4 h-4" /> Masons</TabsTrigger>
          </TabsList>

          <TabsContent value="role">
            <RoleTab member={member} currentUserRole={currentUserRole} onSave={onSaveRole} />
          </TabsContent>

          <TabsContent value="hierarchy">
            <HierarchyTab member={member} allTeamMembers={allTeamMembers} currentUserRole={currentUserRole} onSave={onSaveMapping} />
          </TabsContent>

          <TabsContent value="dealers">
            <DealerTab member={member} onSave={onSaveDealerMapping} />
          </TabsContent>

          <TabsContent value="masons">
            <MasonTab member={member} onSave={onSaveMasonMapping} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}