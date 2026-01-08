// src/app/users/userManagement.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, UserCheck, UserX, Loader2, Search, Smartphone } from 'lucide-react';
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
  DialogTrigger,
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
import { BulkInviteDialog } from './bulkInvite';
import { AppOnlyUserDialog } from './appOnlyInvite';
import { Zone } from '@/lib/Reusable-constants';
import { email } from 'zod';

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
  deviceId?: string | null;
  isDashboardUser?: boolean | null;
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

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'president':
      return 'destructive';
    case 'senior-general-manager':
      return 'default';
    case 'general-manager':
      return 'secondary';
    case 'regional-sales-manager':
      return 'outline';
    case 'area-sales-manager':
      return 'destructive';
    case 'senior-manager':
      return 'default';
    case 'manager':
      return 'secondary';
    case 'assistant-manager':
      return 'outline';
    case 'senior-executive':
    case 'executive':
    case 'junior-executive':
      return 'outline';
    default:
      return 'outline';
  }
};

const isUserEffectivelyActive = (user: User) => {
  // 1. If there is an invite token, they haven't accepted the invite yet -> Pending
  if (user.inviteToken) return false;

  // 2. If the status is explicitly 'pending' or starts with 'pending_' -> Pending
  if (user.status?.toLowerCase().startsWith('pending')) return false;

  // 3. Finally, check if status is explicitly 'active'
  return user.status?.toLowerCase() === 'active';
};

export default function UsersManagement({ adminUser }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    role: 'junior-executive',
    region: '',
    area: '',
    isTechnical: false,
  });

  useEffect(() => {
    if (locations.regions.length > 0 && locations.areas.length > 0) {
      setFormData(prev => ({
        ...prev,
        region: prev.region || locations.regions[0],
        area: prev.area || locations.areas[0]
      }));
    }
  }, [locations]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const apiURI = `/api/users`;
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(apiURI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        await fetchUsers();
        setShowCreateModal(false);
        resetForm();
        let successMsg = `User created and invitation sent to ${formData.email}.`;
        if (data.user && data.user.salesmanLoginId) {
          successMsg += ` Employee ID for mobile app: ${data.user.salesmanLoginId}. Password sent via email.`;
        }
        if (data.user && data.user.techLoginId) {
          successMsg += ` Technical ID for mobile app: ${data.user.techLoginId}.`;
        }
        setSuccess(successMsg);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Error creating user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e?: React.FormEvent, isUpgrade: boolean = false) => {
    if (e) e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${apiURI}/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, isDashboardUser: isUpgrade })
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

  const handleDeleteUser = async (userId: number, workosUserId: string | null, email: string) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${apiURI}/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        if (workosUserId || email) {
          const workosDeleteResponse = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workosUserId: workosUserId, email: email })
          });

          if (workosDeleteResponse.ok) {
            setSuccess('User deleted successfully from System and WorkOS.');
          } else {
            const errorData = await workosDeleteResponse.json();
            // This is a "Partial Success" - deleted locally, but failed in WorkOS
            setError(`User deleted locally, but failed to delete from Auth Provider: ${errorData.error}`);
          }
        } else {
          // No ID and no Email? Just local delete is fine.
          setSuccess('User deleted successfully (Local only).');
        }
        await fetchUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user locally');
      }
    } catch (err) {
      setError('Error deleting user');
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
        // 1. Refresh the main users list in the background
        await fetchUsers();

        // 2. REFRESH MODAL STATE: Update the local editingUser object
        setEditingUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            deviceId: null // This force-refreshes the UI inside the Dialog
          };
        });

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
      role: user.role,
      region: user.region || '',
      area: user.area || '',
      isTechnical: user.isTechnicalRole || false,
    });
  };

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      role: 'junior-executive',
      region: '',
      area: '',
      isTechnical: false,
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
      // 1. Search (Name or Email)
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const search = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        fullName.includes(search) ||
        (user.email || '').toLowerCase().includes(search);

      // 2. Role Filter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      // 3. Region Filter
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
      // We use an accessorFn so that "fullName" is a searchable/sortable string
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
        <Badge variant={getRoleBadgeVariant(row.original.role)}>
          {row.original.role.replace(/-/g, ' ')}
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
      accessorKey: "isTechnicalRole",
      header: "Technical Role",
      cell: ({ row }) => {
        return row.original.isTechnicalRole ? (
          <span className="font-medium text-white flex items-center justify-center">Yes</span>
        ) : (
          <span className="text-gray-500 flex items-center justify-center">No</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        // LOGIC 1: App-Only Check
        // If they have NO WorkOS ID and NO Invite Token, they are purely local (App-Only)
        // regardless of what the status string says.
        const isAppOnly = !user.workosUserId && !user.inviteToken;

        // LOGIC 2: Active vs Pending (Only for Dashboard Users)
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

            {/* {user.id !== adminUser.id && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {user.firstName} {user.lastName}?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteUser(user.id, user.workosUserId, user.email)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )} */}
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
            {/* <BulkInviteDialog
              onSuccess={handleSuccess}
              onError={handleError}
              onRefreshUsers={fetchUsers}
            /> */}

            <AppOnlyUserDialog
              onSuccess={(msg) => setSuccess(msg)}
              onError={(msg) => setError(msg)}
              onRefresh={fetchUsers}
            />

            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User & Send Invitation</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="John"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      placeholder="9999900000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="president">President</SelectItem>
                        <SelectItem value="senior-general-manager">Senior General Manager</SelectItem>
                        <SelectItem value="general-manager">General Manager</SelectItem>
                        <SelectItem value="regional-sales-manager">Regional Sales Manager</SelectItem>
                        <SelectItem value="area-sales-manager">Area Sales Manager</SelectItem>
                        <SelectItem value="senior-manager">Senior Manager</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="assistant-manager">Assistant Manager</SelectItem>
                        <SelectItem value="senior-executive">Senior Executive</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                        <SelectItem value="junior-executive">Junior Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="isTechnical-create"
                      checked={formData.isTechnical}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isTechnical: !!checked })
                      }
                    />
                    <Label htmlFor="isTechnical-create" className="text-sm font-medium">
                      Check if Technical Role
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="region">Region(Zone)</Label>
                      <Select
                        value={formData.region}
                        onValueChange={(value) => setFormData({ ...formData, region: value })}
                      >
                        <SelectTrigger id="region">
                          <SelectValue placeholder="Select Region" />
                        </SelectTrigger>
                        <SelectContent>
                          {Zone.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="area">Area</Label>
                      <Input
                        id="area"
                        placeholder="Enter Area"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-4">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? 'Creating...' : 'Create User'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
              <DialogContent key={`${editingUser?.id}-${editingUser?.deviceId}`}>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email Address</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="user@example.com"
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
                        placeholder="Name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-lastName">Last Name</Label>
                      <Input
                        id="edit-lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Surname"
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
                      placeholder="0000099999"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="isTechnical-edit"
                      checked={formData.isTechnical}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isTechnical: !!checked })
                      }
                    />
                    <Label htmlFor="isTechnical-edit" className="text-sm font-medium">
                      Check if Technical Role
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-region">Region(Zone)</Label>
                      <Select
                        value={formData.region}
                        onValueChange={(value) => setFormData({ ...formData, region: value })}
                      >
                        <SelectTrigger id="edit-region">
                          <SelectValue placeholder="Select Region" />
                        </SelectTrigger>
                        <SelectContent>
                          {Zone.map((zone) => (
                            <SelectItem key={zone} value={zone}>
                              {zone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-area">Area</Label>
                      <Input
                        id="edit-area"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        placeholder="Central"
                      />
                    </div>
                  </div>
                  {/* --- User Dashboard Access Section --- */}
                  {!editingUser?.workosUserId && !editingUser?.inviteToken && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label className="text-sm font-semibold">Dashboard Access Management</Label>
                      <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status: App-Only</span>
                          <span className="text-sm">No dashboard access</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary/5"
                          onClick={() => handleUpdateUser(undefined, true)}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Give Dashboard Access"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        * This will trigger an invitation email and grant access to this dashboard.
                      </p>
                    </div>
                  )}
                  {/* --- Device ID Section --- */}
                  <div className="space-y-2 pt-4 border-t">
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
          {/* 1. Search Input */}
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

          {/* 2. Role Filter */}
          {renderSelectFilter(
            'Role',
            roleFilter,
            setRoleFilter,
            roleOptions,
            loading
          )}

          {/* 3. Region Filter */}
          {renderSelectFilter(
            'Region(Zone)',
            regionFilter,
            setRegionFilter,
            regionOptions,
            loading
          )}
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