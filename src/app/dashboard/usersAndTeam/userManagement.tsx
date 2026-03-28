// src/app/users/userManagement.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Edit, UserCheck, UserX, Loader2, Search, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserLocations } from '@/components/reusable-user-locations';

import { DataTableReusable } from '@/components/data-table-reusable';
import { ColumnDef } from '@tanstack/react-table';
import { Zone } from '@/lib/Reusable-constants';
import { AddUserDialog } from './AddUser';

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: string;
  region: string | null;
  area: string | null;
  workosUserId: string | null;
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
  workosUserId: string | null;
}

interface Props {
  adminUser: AdminUser;
}

const ORG_ROLES = [
  'Admin', 'chief-managing-director', 'director', 'president', 
  'senior-general-manager', 'general-manager', 'deputy-general-manager', 'assistant-general-manager',
  'senior-regional-manager', 'regional-manager', 'deputy-manager', 'senior-area-manager', 'area-manager', 
  'senior-executive', 'executive', 'junior-executive'
];

const JOB_ROLES = [
  'Admin', 'System-Admin', 'Sales-Marketing', 'Technical-Sales', 
  'Reports-MIS', 'IT', 'Accounting', 'Logistics', 'Human Resources', 'Factory-Operations'
];

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
  const { locations, loading: locationsLoading, error: locationsError } = useUserLocations();

  // --- Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    orgRole: 'junior-executive',
    jobRole: 'Sales-Marketing',
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
    setFormData({
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phoneNumber: user.phoneNumber || '',
      orgRole: user.role || 'junior-executive', // Fallback to raw role if orgRole doesn't exist uniquely yet
      jobRole: 'Sales-Marketing', // Default fallback
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
      jobRole: 'Sales-Marketing',
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
    users.forEach(u => { if (u.role) roles.add(u.role); });
    return Array.from(roles).sort();
  }, [users]);

  const regionOptions = useMemo(() => {
    const regions = new Set<string>();
    users.forEach(u => { if (u.region) regions.add(u.region); });
    return Array.from(regions).sort();
  }, [users]);

  // --- Client Side Filtering Logic ---
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const search = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        fullName.includes(search) ||
        (user.email || '').toLowerCase().includes(search);

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesRegion = regionFilter === 'all' || user.region === regionFilter;

      return matchesSearch && matchesRole && matchesRegion;
    });
  }, [users, searchQuery, roleFilter, regionFilter]);

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
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => row.original.phoneNumber || '-',
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.role ? row.original.role.replace(/-/g, ' ') : 'N/A'}
        </Badge>
      ),
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
                      <div className="space-y-2">
                        <Label>Job Role</Label>
                        <Select value={formData.jobRole} onValueChange={(v) => setFormData({ ...formData, jobRole: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {JOB_ROLES.map(role => (
                              <SelectItem key={role} value={role}>{role.replace(/-/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

        {/* --- Filter Components --- */}
        <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg bg-card border">
          <div className="flex flex-col space-y-1 w-full sm:w-[250px] min-w-[150px]">
            <label className="text-sm font-medium text-muted-foreground">Search User</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {renderSelectFilter('Role', roleFilter, setRoleFilter, roleOptions, loading)}
          {renderSelectFilter('Region(Zone)', regionFilter, setRegionFilter, regionOptions, loading)}
        </div>

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