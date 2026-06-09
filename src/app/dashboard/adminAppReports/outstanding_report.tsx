// src/app/dashboard/adminAppReports/outstanding_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export default function OutstandingReportPage() {
    const [dataList, setDataList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [searchVal, setSearchVal] = useState<string>("");
    // Added date range state hook for the filter bar
    const [dateRangeVal, setDateRangeVal] = useState<DateRange | undefined>();

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                
                const params = new URLSearchParams();
                params.append('limit', '1000'); // Explicit limit mirroring backend default
                
                if (dateRangeVal?.from) {
                    params.append('fromDate', format(dateRangeVal.from, 'yyyy-MM-dd'));
                }
                if (dateRangeVal?.to) {
                    params.append('toDate', format(dateRangeVal.to, 'yyyy-MM-dd'));
                }

                const endpoint = `/api/dashboardPagesAPI/admin-app-reports/outstanding${params.toString() ? `?${params.toString()}` : ''}`;
                
                const res = await fetch(endpoint);
                const result = await res.json();
                
                if (result.success && result.data) {
                    // Normalize IDs to prevent rendering issues in generic tables
                    const normalized = (Array.isArray(result.data) ? result.data : []).map((row: any, index: number) => ({
                        ...row,
                        id: row.id ? String(row.id) : `out-row-${index}`
                    }));
                    setDataList(normalized);
                }
            } catch (err) { 
                console.error("Failed to fetch Outstanding Reports", err); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchReport();
    }, [dateRangeVal]); // Triggers fetch when date changes

    const filterArray = (arr: any[]) => {
        if (!arr || !Array.isArray(arr)) return [];
        if (!searchVal.trim()) return arr;
        const lowerSearch = searchVal.toLowerCase();
        return arr.filter(row => 
            Object.values(row).some(val => String(val).toLowerCase().includes(lowerSearch))
        );
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Outstanding Data...</div>;

    const filteredData = filterArray(dataList);

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Outstanding Reports (Recent)</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Review outstanding balances and security deposits.</p>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    Records: {filteredData.length}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                <GlobalFilterBar 
                    showSearch={true} 
                    searchVal={searchVal} 
                    onSearchChange={setSearchVal} 
                    showDateRange={true} 
                    dateRangeVal={dateRangeVal} 
                    onDateRangeChange={setDateRangeVal} 
                />

                <div className="w-full">
                    <GenericJsonTable data={filteredData} />
                </div>
            </CardContent>
        </Card>
    );
}