// src/app/dashboard/logisticsIO/logisticsUsers.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
    Search, ShieldAlert, Factory, User, ShieldCheck,
    Truck, Scale, Store
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableReusable } from '@/components/data-table-reusable';
import { AddLogisticsUserDialog } from '../logisticsIO/addUser-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Update this to match your exact Drizzle schema interface if needed
interface LogisticsUser {
    id: string; // Kept in interface for React keys, but not shown in columns
    userName: string;
    userRole: string;
    sourceName?: string | null;
}

const API_URL = `/api/dashboardPagesAPI/logistics-io/logistics-users`;

export default function LogisticsUsersList() {
    const [users, setUsers] = useState<LogisticsUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');

    // --- Fetch Data ---
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (filterRole && filterRole !== 'all') params.append('role', filterRole);

            // Requesting a large page size for a simplified client-side table, 
            // adjust if you want proper server-side pagination.
            params.append('pageSize', '500');

            const response = await fetch(`${API_URL}?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();

            // The API returns { data: [...], totalCount, page, pageSize }
            if (result.data) {
                setUsers(result.data);
            } else {
                setUsers([]);
            }

        } catch (e: any) {
            console.error('Failed to fetch logistics users:', e);
            setError(e.message || 'An unknown error occurred.');
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filterRole]);

    // Fetch on mount and when filters change
    useEffect(() => {
        // Adding a slight debounce for the search query to prevent spamming the API
        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, filterRole, fetchUsers]);

    // --- Columns Definition ---
    const columns: ColumnDef<LogisticsUser>[] = [
        {
            header: 'Username',
            accessorKey: 'userName',
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                        <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.original.userName}
                    </span>
                </div>
            )
        },
        {
            header: 'Assigned Role',
            accessorKey: 'userRole',
            cell: ({ row }) => {
                const role = (row.original.userRole || '').toUpperCase();

                // Define aesthetic styling based on the role
                let badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
                let Icon = ShieldAlert;

                if (role === 'GATE') {
                    badgeStyle = "bg-blue-950/30 text-blue-400 border-blue-900/50";
                    Icon = Truck;
                } else if (role === 'WB') {
                    badgeStyle = "bg-orange-950/30 text-orange-400 border-orange-900/50";
                    Icon = Scale;
                } else if (role === 'STORE') {
                    badgeStyle = "bg-emerald-950/30 text-emerald-400 border-emerald-900/50";
                    Icon = Store;
                } else if (role === 'ADMIN') {
                    badgeStyle = "bg-purple-950/30 text-purple-400 border-purple-900/50";
                    Icon = ShieldCheck;
                }

                return (
                    <Badge variant="outline" className={`${badgeStyle} px-2.5 py-1`}>
                        <Icon className="w-3.5 h-3.5 mr-1.5" />
                        {role || 'UNKNOWN'}
                    </Badge>
                );
            }
        },
        {
            header: 'Assigned Source / Factory',
            accessorKey: 'sourceName',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.sourceName ? (
                        <>
                            <Factory className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {row.original.sourceName}
                            </span>
                        </>
                    ) : (
                        <span className="text-sm italic text-slate-400">All Sources (Global)</span>
                    )}
                </div>
            )
        }
    ];

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <ShieldAlert className="h-8 w-8 mb-2 opacity-80" />
                <p className="font-medium">Error: {error}</p>
                <Button variant="outline" className="mt-4" onClick={fetchUsers}>Try Again</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* --- Filter Bar --- */}
            <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-end">
                <div className="flex flex-col space-y-1.5 w-full sm:w-[300px]">
                    <label className="text-xs font-semibold text-muted-foreground">Search Users</label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by username or factory..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                </div>

                <div className="flex flex-col space-y-1.5 w-[200px]">
                    <label className="text-xs font-semibold text-muted-foreground">Filter by Role</label>
                    <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="GATE">Gate Operators</SelectItem>
                            <SelectItem value="WB">Weighbridge Operators</SelectItem>
                            <SelectItem value="STORE">Store Operators</SelectItem>
                        </SelectContent>
                    </Select>

                </div>

                <Button
                    onClick={fetchUsers}
                    variant="secondary"
                    size="sm"
                    className="h-9 mb-px"
                    disabled={loading}
                >
                    Refresh List
                </Button>

                <div className="mb-px border-l pl-4 border-border ml-auto">
                    <AddLogisticsUserDialog />
                </div>
            </div>

            {/* --- Data Table --- */}
            {loading && users.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border rounded-lg bg-card/50">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p>Loading operator accounts...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground rounded-lg border border-dashed bg-card/50">
                    <User className="h-8 w-8 mb-2 opacity-20" />
                    <p>No logistics users found matching your filters.</p>
                </div>
            ) : (
                <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                    <DataTableReusable
                        columns={columns}
                        data={users}
                        enableRowDragging={false}
                        onRowOrderChange={() => { }}
                    />
                </div>
            )}
        </div>
    );
}