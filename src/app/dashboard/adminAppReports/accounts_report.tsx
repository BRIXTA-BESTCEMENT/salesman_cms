// src/app/dashboard/adminAppReports/accounts_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { NEXT_PUBLIC_MYCOCOSERVER_URL } from '@/lib/Reusable-constants';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { DateRange } from 'react-day-picker';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableReusable } from '@/components/data-table-reusable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const accountsColumns: ColumnDef<any>[] = [
    { accessorKey: "reportDate", header: "Date" },
    { accessorKey: "collectionTargetLakhs", header: "Col. Target (L)" },
    { accessorKey: "collectionAchievementLakhs", header: "Col. Achv. (L)" },
    { accessorKey: "spendTargetLakhs", header: "Spend Target (L)" },
    { accessorKey: "spendAchievementLakhs", header: "Spend Achv. (L)" },
    { accessorKey: "pettyCashBalanceLakhs", header: "Petty Cash (L)" },
    { accessorKey: "billsPendingLakhs", header: "Bills Pending (L)" },
    { accessorKey: "tenDaysCashReqCr", header: "10 Days Req (Cr)" },
    { accessorKey: "expectedInflowSalesCr", header: "Exp. Inflow (Cr)" },
    { accessorKey: "cmdPaymentDueLakhs", header: "CMD Due (L)" },
    { accessorKey: "cashBookStatusJUD", header: "CB JUD" },
    { accessorKey: "cashBookStatusJSB", header: "CB JSB" },
    { accessorKey: "remarks", header: "Remarks" },
];

export default function AccountsReportPage() {
    const [dataList, setDataList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchVal, setSearchVal] = useState<string>("");
    const [dateRangeVal, setDateRangeVal] = useState<DateRange | undefined>();

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${NEXT_PUBLIC_MYCOCOSERVER_URL}/api/accounts-reports?limit=100`);
                const result = await res.json();

                if (result.success && result.data) {
                    const normalized = (Array.isArray(result.data) ? result.data : []).map((row: any, index: number) => ({
                        ...row,
                        id: row.id ? String(row.id) : `acc-row-${index}` // Strictly map id to keep uniqueIdentifier happy
                    }));
                    setDataList(normalized);
                }
            } catch (err) {
                console.error("Failed to fetch Accounts", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReport();
    }, [dateRangeVal]);

    const filterArray = (arr: any[]) => {
        if (!arr || !Array.isArray(arr)) return [];
        if (!searchVal.trim()) return arr;
        const lowerSearch = searchVal.toLowerCase();
        return arr.filter(row =>
            row && Object.values(row).some(val => String(val).toLowerCase().includes(lowerSearch))
        );
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Accounts Data...</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Accounts Dashboard</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Daily overview of collections, spends, and cash requirements.</p>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    Records: {filterArray(dataList).length}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                <GlobalFilterBar
                    showSearch={true} searchVal={searchVal} onSearchChange={setSearchVal}
                    showDateRange={true} dateRangeVal={dateRangeVal} onDateRangeChange={setDateRangeVal}
                />

                <div className="w-full">
                    <DataTableReusable
                        columns={accountsColumns}
                        data={filterArray(dataList)}
                    />
                </div>
            </CardContent>
        </Card>
    );
}