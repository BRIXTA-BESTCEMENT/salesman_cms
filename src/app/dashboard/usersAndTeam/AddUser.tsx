// src/app/users/AddUser.tsx
'use client';

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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
import { Zone } from '@/lib/Reusable-constants';

interface AddUserProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onRefresh: () => void;
}

const ORG_ROLES = [
  'Admin', 'Manager', 'Assistant-Manager',  
  'chief-managing-director', 'director', 'president', 
  'senior-general-manager', 'general-manager', 'deputy-general-manager', 'assistant-general-manager',
  'senior-regional-manager', 'regional-manager', 'deputy-manager', 'senior-area-manager', 'area-manager', 
  'senior-executive', 'executive', 'junior-executive'
];

const JOB_ROLES = [
  'Admin', 'Sales-Marketing', 'Technical-Sales', 'Reports-MIS', 'IT', 
  'Accounting', 'Logistics', 'Human Resources', 'Factory-Operations'
];

export function AddUserDialog({ onSuccess, onError, onRefresh }: AddUserProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    orgRole: 'junior-executive',
    jobRole: 'Sales-Marketing',
    region: Zone[0] || '',
    area: '',
    isDashboardUser: false,
    isSalesAppUser: false,
    isTechnicalRole: false,
    isAdminAppUser: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Map orgRole to the 'role' field to maintain backward compatibility with the users table schema
    const payload = {
      ...formData,
      role: formData.orgRole 
    };

    try {
      const response = await fetch('/api/dashboardPagesAPI/users-and-team/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        let successMsg = `User ${formData.firstName} created successfully!`;
        if (formData.isDashboardUser || formData.isSalesAppUser || formData.isTechnicalRole || formData.isAdminAppUser) {
            successMsg += ` Credentials have been sent to ${formData.email}.`;
        } else {
            successMsg += ` No app access was granted.`;
        }

        onSuccess(successMsg);
        onRefresh();
        setOpen(false);
        resetForm();
      } else {
        onError(data.error || 'Failed to create user');
      }
    } catch (err) {
      onError('An error occurred during creation.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '', firstName: '', lastName: '', phoneNumber: '',
      orgRole: 'junior-executive', jobRole: 'Sales-Marketing', 
      region: Zone[0] || '', area: '',
      isDashboardUser: false, isSalesAppUser: false, isTechnicalRole: false, isAdminAppUser: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Configure the user's role and select which platforms they are allowed to access.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          
          {/* Identity Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold border-b pb-1">Identity Details</h4>
            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                id="email" type="email" required placeholder="user@email.com"
                value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                    id="firstName" required placeholder="First Name"
                    value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                    id="lastName" placeholder="Last Name" required
                    value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                id="phoneNumber" type="tel" placeholder="9999900000"
                value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
            </div>
          </div>

          {/* Role & Location Section */}
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {Zone.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                <Label>Area</Label>
                <Input value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })} placeholder="e.g. Central" />
                </div>
            </div>
          </div>

          {/* Access Control Section */}
          <div className="space-y-4 pt-2">
             <h4 className="text-sm font-semibold border-b pb-1 text-primary">Platform Access Permissions</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md border">
                 <div className="flex items-center space-x-3">
                    <Checkbox
                        id="acc-dashboard"
                        checked={formData.isDashboardUser}
                        onCheckedChange={(c) => setFormData({ ...formData, isDashboardUser: !!c })}
                    />
                    <Label htmlFor="acc-dashboard" className="cursor-pointer">Web Dashboard Access</Label>
                 </div>
                 <div className="flex items-center space-x-3">
                    <Checkbox
                        id="acc-sales"
                        checked={formData.isSalesAppUser}
                        onCheckedChange={(c) => setFormData({ ...formData, isSalesAppUser: !!c })}
                    />
                    <Label htmlFor="acc-sales" className="cursor-pointer">Sales App Access</Label>
                 </div>
                 <div className="flex items-center space-x-3">
                    <Checkbox
                        id="acc-tech"
                        checked={formData.isTechnicalRole}
                        onCheckedChange={(c) => setFormData({ ...formData, isTechnicalRole: !!c })}
                    />
                    <Label htmlFor="acc-tech" className="cursor-pointer">Technical App Access</Label>
                 </div>
                 <div className="flex items-center space-x-3">
                    <Checkbox
                        id="acc-admin"
                        checked={formData.isAdminAppUser}
                        onCheckedChange={(c) => setFormData({ ...formData, isAdminAppUser: !!c })}
                    />
                    <Label htmlFor="acc-admin" className="cursor-pointer">Admin App Access</Label>
                 </div>
             </div>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User & Send Invites'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}