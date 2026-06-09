// src/app/dashboard/adminAppReports/sales_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { NEXT_PUBLIC_MYCOCOSERVER_URL } from '@/lib/Reusable-constants';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { DateRange } from 'react-day-picker';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableReusable } from '@/components/data-table-reusable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const salesColumns: ColumnDef<any>[] = [
    { accessorKey: "reportDate", header: "Date" },
    { accessorKey: "area", header: "Area" },
    { accessorKey: "dealerName", header: "Dealer Name" },
    { accessorKey: "responsiblePerson", header: "Responsible Person" },
    { accessorKey: "currentMonthMTDSales", header: "MTD Sales" },
    { accessorKey: "currentMonthTarget", header: "Target" },
    { accessorKey: "percentageTargetAchieved", header: "% Achieved" },
    { accessorKey: "balance", header: "Balance" },
    { accessorKey: "prorataSalesTarget", header: "Prorata Target" },
    { accessorKey: "percentageAsPerProrata", header: "% Prorata" },
    { accessorKey: "askingRate", header: "Asking Rate" },
];

export default function SalesReportPage() {
    const [dataList, setDataList] = useState<any[]>([]);
    const [reportDate, setReportDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [searchVal, setSearchVal] = useState<string>("");
    const [dateRangeVal, setDateRangeVal] = useState<DateRange | undefined>();

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${NEXT_PUBLIC_MYCOCOSERVER_URL}/api/adminapp/sales-reports/latest`);
                const result = await res.json();

                if (result.success && result.data) {
                    setReportDate(result.data.reportDate || "");
                    setDataList(Array.isArray(result.data.salesDataPayload) ? result.data.salesDataPayload : []);
                }
            } catch (err) {
                console.error("Failed to fetch Sales", err);
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
            Object.values(row).some(val => String(val).toLowerCase().includes(lowerSearch))
        );
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Sales Data...</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Sales Reports</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {reportDate ? `Report Date: ${reportDate}` : "Review MTD sales, targets, and balances."}
                    </p>
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
                    <DataTableReusable columns={salesColumns} data={filterArray(dataList)} />
                </div>
            </CardContent>
        </Card>
    );
}