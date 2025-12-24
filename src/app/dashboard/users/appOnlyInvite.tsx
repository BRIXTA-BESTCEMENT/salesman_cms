// src/pp/users/appOnlyInvite.tsx
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

interface AppOnlyUserDialogProps {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
    onRefresh: () => void;
}

export function AppOnlyUserDialog({ onSuccess, onError, onRefresh }: AppOnlyUserDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        role: 'junior-executive',
        region: Zone[0] || '',
        area: '',
        isTechnical: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('/api/users/app-only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                onSuccess(`App-Only user created. Credentials: ID ${data.user.salesmanLoginId}`);
                onRefresh();
                setOpen(false);
                setFormData({
                    email: '', firstName: '', lastName: '', phoneNumber: '',
                    role: 'junior-executive', region: Zone[0], area: '', isTechnical: false
                });
            } else {
                onError(data.error || 'Failed to create app-only user');
            }
        } catch (err) {
            onError('An error occurred during creation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-2 border-primary text-primary hover:bg-primary/5">
                    <Plus className="w-4 h-4 mr-2" />
                    Add App-Only User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add App-Only User</DialogTitle>
                    <p className="text-xs text-muted-foreground">
                        This user will NOT receive a dashboard invite. They will only receive mobile app credentials.
                    </p>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="app-email">Email Address</Label>
                        <Input
                            id="app-email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="app-firstName">First Name</Label>
                            <Input
                                id="app-firstName"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="app-lastName">Last Name</Label>
                            <Input
                                id="app-lastName"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="app-phone">Phone Number</Label>
                        <Input
                            id="app-phone"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="app-role">Role</Label>
                        <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="app-tech"
                            checked={formData.isTechnical}
                            onCheckedChange={(c) => setFormData({ ...formData, isTechnical: !!c })}
                        />
                        <Label htmlFor="app-tech">Include Technical App Access</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Region</Label>
                            <Select value={formData.region} onValueChange={(v) => setFormData({ ...formData, region: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Zone.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Area</Label>
                            <Input value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })} />
                        </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create App-Only User'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}