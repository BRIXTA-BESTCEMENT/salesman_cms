// src/app/dashboard/logisticsIO/logisticsUsers.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
    ShieldAlert, Factory, User, ShieldCheck,
    Truck, Scale, Store, Loader2, RefreshCw
} from 'lucide-react';

// Standard Components
import { DataTableReusable } from '@/components/data-table-reusable';
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search'; 
import { AddLogisticsUserDialog } from '../logisticsIO/addUser-dialog';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LogisticsUser {
    id: string; 
    userName: string;
    userRole: string;
    sourceName?: string | null;
}

const API_URL = `/api/dashboardPagesAPI/logistics-io/logistics-users`;

export default function LogisticsUsersList() {
    const [users, setUsers] = useState<LogisticsUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Standardized Filter State ---
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // --- Fetch Data ---
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL(API_URL, window.location.origin);
            if (debouncedSearchQuery) url.searchParams.append('search', debouncedSearchQuery);
            if (roleFilter !== 'all') url.searchParams.append('role', roleFilter);
            url.searchParams.append('pageSize', '500');

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            setUsers(result.data || []);
        } catch (e: any) {
            console.error('Failed to fetch logistics users:', e);
            setError(e.message || 'An unknown error occurred.');
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [debouncedSearchQuery, roleFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // --- Filter Options Mapping ---
    const roleOptions = useMemo(() => [
        { label: 'All Roles', value: 'all' },
        { label: 'Gate Operators', value: 'GATE' },
        { label: 'Weighbridge Operators', value: 'WB' },
        { label: 'Store Operators', value: 'STORE' },
        { label: 'Admins', value: 'ADMIN' },
    ], []);

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
                    <Badge variant="outline" className={`${badgeStyle} px-2.5 py-1 shadow-none border-0`}>
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

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground w-full">
            <div className="flex-1 space-y-6 w-full">
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-bold tracking-tight">Logistics Operator Accounts</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <AddLogisticsUserDialog />
                    </div>
                </div>

                {/* --- Unified Global Filter Bar --- */}
                <div className="w-full relative z-50">
                    <GlobalFilterBar 
                        showSearch={true}
                        showRole={true} // Using Role slot for userRole
                        showStatus={false}
                        showDateRange={false}
                        showZone={false}
                        showArea={false}

                        searchVal={searchQuery}
                        roleVal={roleFilter}

                        roleOptions={roleOptions}

                        onSearchChange={setSearchQuery}
                        onRoleChange={setRoleFilter}
                    />
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-red-500 bg-destructive/10 rounded-lg border border-destructive/20">
                        <ShieldAlert className="h-8 w-8 mb-2 opacity-80" />
                        <p className="font-medium">Error: {error}</p>
                        <Button variant="outline" className="mt-4" onClick={fetchUsers}>Try Again</Button>
                    </div>
                ) : (
                    <div className="bg-card p-1 rounded-lg border border-border shadow-sm relative z-0">
                        {loading && users.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                <p>Loading operator accounts...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground py-12">
                                <User className="h-8 w-8 mb-2 opacity-20" />
                                <p>No logistics users found matching the filters.</p>
                            </div>
                        ) : (
                            <DataTableReusable
                                columns={columns}
                                data={users}
                                enableRowDragging={false}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}