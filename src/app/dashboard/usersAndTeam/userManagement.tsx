// src/app/users/userManagement.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Edit, UserCheck, UserX, Loader2, Smartphone, Copy, Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUserLocations } from '@/components/reusable-user-locations';
import { useDebounce } from '@/hooks/use-debounce-search';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { DataTableReusable } from '@/components/data-table-reusable';
import { ColumnDef } from '@tanstack/react-table';
import { Zone, ORG_ROLES, JOB_ROLES } from '@/lib/Reusable-constants';
import { AddUserDialog } from './AddUser';

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  orgRole: string;
  jobRole?: string[];
  region: string | null;
  area: string | null;
  inviteToken: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
  salesmanLoginId?: string | null;
  isTechnicalRole?: boolean | null;
  isAdminAppUser?: boolean | null;
  deviceId?: string | null;
  isDashboardUser?: boolean | null;
  isSalesAppUser?: boolean | null;
}

interface Company {
  id: number;
  companyName: string;
}

interface AdminUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  company: Company;
}

interface Props {
  adminUser: AdminUser;
}

interface GeneratedCredentials {
  dashboardEmail?: string;
  dashboardPassword?: string;
  salesmanId?: string;
  salesmanPassword?: string;
  techId?: string;
  techPassword?: string;
  adminId?: string;
  adminPassword?: string;
}

const isUserEffectivelyActive = (user: User) => {
  if (user.inviteToken) return false;
  if (user.status?.toLowerCase().startsWith('pending')) return false;
  return user.status?.toLowerCase() === 'active';
};

export default function UsersManagement({ adminUser }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { loading: locationsLoading, error: locationsError } = useUserLocations();

  // Credentials Success View State for Edit
  const [updatedCredentials, setUpdatedCredentials] = useState<GeneratedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [roleFilter, setRoleFilter] = useState('all');
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);
  const [areaFilters, setAreaFilters] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    orgRole: 'junior-executive',
    jobRole: [] as string[],
    region: '',
    area: '',
    isDashboardUser: false,
    isSalesAppUser: false,
    isTechnical: false,
    isAdminAppUser: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const apiURI = `/api/dashboardPagesAPI/users-and-team/users`;

  const fetchUsers = async () => {
    try {
      const response = await fetch(apiURI);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      setError('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${apiURI}/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchUsers();
        setEditingUser(null);
        resetForm();
        setSuccess('User updated successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update user');
      }
    } catch (err) {
      setError('Error updating user');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!updatedCredentials) return;
    let text = "User Credentials (Update):\n";
    if (updatedCredentials.dashboardEmail) text += `\n[Web Dashboard]\nID: ${updatedCredentials.dashboardEmail}\nPassword: ${updatedCredentials.dashboardPassword}\n`;
    if (updatedCredentials.salesmanId) text += `\n[Sales App]\nID: ${updatedCredentials.salesmanId}\nPassword: ${updatedCredentials.salesmanPassword}\n`;
    if (updatedCredentials.techId) text += `\n[Technical App]\nID: ${updatedCredentials.techId}\nPassword: ${updatedCredentials.techPassword}\n`;
    if (updatedCredentials.adminId) text += `\n[Admin App]\nID: ${updatedCredentials.adminId}\nPassword: ${updatedCredentials.adminPassword}\n`;

    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDoneUpdate = () => {
    setEditingUser(null);
    resetForm();
    setUpdatedCredentials(null);
    setSuccess('User updated successfully');
  };

  const handleClearDeviceId = async (userId: number) => {
    if (!confirm("Are you sure you want to clear this user's device lock?")) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiURI}/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearDevice: true })
      });

      if (response.ok) {
        await fetchUsers();
        setEditingUser((prev) => prev ? { ...prev, deviceId: null } : null);
        setSuccess('Device ID cleared successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to clear device ID');
      }
    } catch (err) {
      setError('Error clearing device ID');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setUpdatedCredentials(null);
    setFormData({
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phoneNumber: user.phoneNumber || '',
      orgRole: user.orgRole || 'junior-executive',
      jobRole: user.jobRole || [],
      region: user.region || '',
      area: user.area || '',
      isDashboardUser: user.isDashboardUser || false,
      isSalesAppUser: user.isSalesAppUser || false,
      isTechnical: user.isTechnicalRole || false,
      isAdminAppUser: user.isAdminAppUser || false,
    });
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      orgRole: 'junior-executive',
      jobRole: [] as string[],
      region: '',
      area: '',
      isDashboardUser: false,
      isSalesAppUser: false,
      isTechnical: false,
      isAdminAppUser: false,
    });
    setEditingUser(null);
    setError('');
  };

  // --- Derived Options for Filters (Memoized) ---
  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    users.forEach(u => { if (u.orgRole) roles.add(u.orgRole); });
    return [
      { label: 'All Roles', value: 'all' },
      ...Array.from(roles).sort().map(r => ({ label: r.replace(/-/g, ' '), value: r }))
    ];
  }, [users]);

  const zoneOptions = useMemo(() => {
    const regions = new Set<string>();
    users.forEach(u => { if (u.region) regions.add(u.region); });
    // MultiSelect doesn't need an "All" option, it handles "All" when the array is empty
    return Array.from(regions).sort().map(r => ({ label: r, value: r }));
  }, [users]);

  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    users.forEach(u => { if (u.area) areas.add(u.area); });
    // MultiSelect doesn't need an "All" option, it handles "All" when the array is empty
    return Array.from(areas).sort().map(r => ({ label: r, value: r }));
  }, [users]);

  // --- Client Side Filtering Logic ---
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const search = debouncedSearch.toLowerCase(); 
      const matchesSearch = !debouncedSearch || fullName.includes(search);

      const matchesRole = roleFilter === 'all' || user.orgRole === roleFilter;
      const matchesZone = zoneFilters.length === 0 || (user.region && zoneFilters.includes(user.region));
      const matchesArea = areaFilters.length === 0 || (user.area && areaFilters.includes(user.area));

      return matchesSearch && matchesRole && matchesZone && matchesArea;
    });
  }, [users, searchQuery, roleFilter, zoneFilters, areaFilters]);

  // Defined columns
  const columns: ColumnDef<User>[] = useMemo(() => [
    {
      accessorKey: "id",
      header: "User ID",
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.id}</span>
    },
    {
      accessorKey: "fullName",
      header: "Name",
      accessorFn: row => `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </div>
      ),
    },
    {
      accessorKey: 'orgRole',
      header: 'Role',
      cell: ({ row }) => {
        const orgRole = row.original.orgRole;
        const jobRoles = row.original.jobRole; 
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{orgRole}</span>
            {jobRoles && jobRoles.length > 0 && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                {jobRoles.join(', ')}
              </span>
            )}
          </div>
        )
      }
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => row.original.phoneNumber || '-',
    },
    {
      accessorKey: "region",
      header: "Region(Zone)",
      cell: ({ row }) => row.original.region || '-',
    },
    {
      accessorKey: "area",
      header: "Area",
      cell: ({ row }) => row.original.area || '-',
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        // Purely local check using our new flags
        const isAppOnly = !user.isDashboardUser && (user.isSalesAppUser || user.isTechnicalRole || user.isAdminAppUser);
        const isActive = isUserEffectivelyActive(user);

        if (isAppOnly) {
          return (
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600 text-sm font-medium">App-Only</span>
            </div>
          );
        }

        return (
          <div className="flex items-center space-x-2">
            {isActive ? (
              <>
                <UserCheck className="w-4 h-4 text-green-500" />
                <span className="text-green-600 text-sm">Active</span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 text-orange-500" />
                <span className="text-orange-600 text-sm">Pending</span>
              </>
            )}
          </div>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => startEdit(user)}
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ], [adminUser.id]);


  if (loading || locationsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading users and locations...</p>
          </div>
        </div>
      </div>
    );
  }

  if (locationsError) {
    return (
      <div className="min-h-screen bg-background p-6 text-center text-red-500">
        <p>Error loading location data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage users for {adminUser.company.companyName}
            </p>
          </div>
          <div className="flex space-x-3">

            <AddUserDialog
              onSuccess={(msg) => { setSuccess(msg); setError(''); }}
              onError={(msg) => { setError(msg); setSuccess(''); }}
              onRefresh={fetchUsers}
            />

            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
              <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" key={`${editingUser?.id}-${editingUser?.deviceId}`}>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                {updatedCredentials ? (
                  // --- SUCCESS CREDENTIALS VIEW ---
                  <div className="space-y-4 py-4">
                    <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900">
                      <KeyRound className="h-4 w-4 text-emerald-600" />
                      <AlertTitle className="text-emerald-800 font-bold">Access Granted!</AlertTitle>
                      <AlertDescription className="text-emerald-700">
                        New credentials have been provisioned based on the updated role access.
                      </AlertDescription>
                    </Alert>

                    <div className="bg-slate-50 border rounded-md p-4 space-y-4 font-mono text-sm max-h-[40vh] overflow-y-auto">
                      {updatedCredentials.dashboardEmail && (
                        <div>
                          <h5 className="font-bold text-slate-700 border-b pb-1 mb-2">Web Dashboard</h5>
                          <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-500">Email/ID:</span>
                            <span className="font-bold text-slate-900">{updatedCredentials.dashboardEmail}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Password:</span>
                            <span className="font-bold text-blue-600">{updatedCredentials.dashboardPassword}</span>
                          </div>
                        </div>
                      )}
                      {updatedCredentials.salesmanId && (
                        <div>
                          <h5 className="font-bold text-slate-700 border-b pb-1 mb-2">Sales App</h5>
                          <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-500">Login ID:</span>
                            <span className="font-bold text-slate-900">{updatedCredentials.salesmanId}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Password:</span>
                            <span className="font-bold text-blue-600">{updatedCredentials.salesmanPassword}</span>
                          </div>
                        </div>
                      )}
                      {updatedCredentials.techId && (
                        <div>
                          <h5 className="font-bold text-slate-700 border-b pb-1 mb-2">Technical App</h5>
                          <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-500">Login ID:</span>
                            <span className="font-bold text-slate-900">{updatedCredentials.techId}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Password:</span>
                            <span className="font-bold text-blue-600">{updatedCredentials.techPassword}</span>
                          </div>
                        </div>
                      )}
                      {updatedCredentials.adminId && (
                        <div>
                          <h5 className="font-bold text-slate-700 border-b pb-1 mb-2">Admin App</h5>
                          <div className="flex justify-between items-center pb-1">
                            <span className="text-slate-500">Login ID:</span>
                            <span className="font-bold text-slate-900">{updatedCredentials.adminId}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">Password:</span>
                            <span className="font-bold text-blue-600">{updatedCredentials.adminPassword}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 pt-2">
                      <Button type="button" variant="outline" className="w-full gap-2 border-slate-300" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied!' : 'Copy Credentials'}
                      </Button>
                      <Button type="button" className="w-full" onClick={handleDoneUpdate}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  // --- EDIT FORM VIEW ---
                  <form onSubmit={handleUpdateUser} className="space-y-5 pt-4">

                    {/* Identity Section */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold border-b pb-1">Identity Details</h4>
                      <div className="space-y-2">
                        <Label htmlFor="edit-email">Email Address</Label>
                        <Input
                          id="edit-email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          disabled
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-firstName">First Name</Label>
                          <Input
                            id="edit-firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-lastName">Last Name</Label>
                          <Input
                            id="edit-lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-phoneNumber">Phone Number</Label>
                        <Input
                          id="edit-phoneNumber"
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Role & Territory Section */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-sm font-semibold border-b pb-1">Role & Territory</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Organization Role</Label>
                          <Select value={formData.orgRole} onValueChange={(v) => setFormData({ ...formData, orgRole: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ORG_ROLES.map(role => (
                                <SelectItem key={role} value={role}>{role.replace(/-/g, ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 flex flex-col justify-end">
                          <Label className="mb-2">Job Roles</Label>
                          <MultiSelect
                            options={JOB_ROLES.map(role => ({ label: role.replace(/-/g, ' '), value: role }))}
                            selectedValues={formData.jobRole}
                            onValueChange={(vals) => setFormData({ ...formData, jobRole: vals })}
                            placeholder="Select Job Roles..."
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Region (Zone)</Label>
                          <Select value={formData.region} onValueChange={(v) => setFormData({ ...formData, region: v })}>
                            <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
                            <SelectContent>
                              {Zone.map((zone) => (
                                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Area</Label>
                          <Input
                            value={formData.area}
                            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                            placeholder="e.g. Central"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Access Control Section */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-sm font-semibold border-b pb-1 text-primary">Platform Access Permissions</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md border">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="edit-acc-dashboard"
                            checked={formData.isDashboardUser}
                            onCheckedChange={(c) => setFormData({ ...formData, isDashboardUser: !!c })}
                          />
                          <Label htmlFor="edit-acc-dashboard" className="cursor-pointer">Web Dashboard Access</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="edit-acc-sales"
                            checked={formData.isSalesAppUser}
                            onCheckedChange={(c) => setFormData({ ...formData, isSalesAppUser: !!c })}
                          />
                          <Label htmlFor="edit-acc-sales" className="cursor-pointer">Sales App Access</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="edit-acc-tech"
                            checked={formData.isTechnical}
                            onCheckedChange={(c) => setFormData({ ...formData, isTechnical: !!c })}
                          />
                          <Label htmlFor="edit-acc-tech" className="cursor-pointer">Technical App Access</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="edit-acc-admin"
                            checked={formData.isAdminAppUser}
                            onCheckedChange={(c) => setFormData({ ...formData, isAdminAppUser: !!c })}
                          />
                          <Label htmlFor="edit-acc-admin" className="cursor-pointer">Admin App Access</Label>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        * Checking an access box for the first time will automatically generate credentials and email the user.
                      </p>
                    </div>

                    {/* --- Device ID Section --- */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-sm font-semibold">Device ID Management</Label>
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Registered Device ID</span>
                          <span className="text-sm font-mono">
                            {editingUser?.deviceId || "No device registered"}
                          </span>
                        </div>
                        {editingUser?.deviceId && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleClearDeviceId(editingUser.id)}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Clear Device ID"}
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        * Clearing the device ID allows the user to bind a new device on their next login attempt.
                      </p>
                    </div>

                    <div className="flex space-x-2 pt-4">
                      <Button type="submit" disabled={loading} className="flex-1">
                        {loading ? 'Updating...' : 'Update User'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingUser(null);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-800 text-blue-200">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* --- Unified Global Filter Bar --- */}
        <GlobalFilterBar 
          // 1. Toggles
          showSearch={true}
          showRole={true}
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          // 2. Values
          searchVal={searchQuery}
          roleVal={roleFilter}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          // 3. Options
          roleOptions={roleOptions}
          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          // 4. Setters
          onSearchChange={setSearchQuery}
          onRoleChange={setRoleFilter}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage your team members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableReusable
              data={filteredUsers}
              columns={columns}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}