// src/app/dashboard/adminAppReports/logistics_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { NEXT_PUBLIC_MYCOCOSERVER_URL } from '@/lib/Reusable-constants';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LogisticsReportPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchVal, setSearchVal] = useState<string>("");
    const [dateRangeVal, setDateRangeVal] = useState<DateRange | undefined>();

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await fetch(`${NEXT_PUBLIC_MYCOCOSERVER_URL}/api/logistics-reports/latest`);
                const result = await res.json();
                if (result.success && result.data) {
                    setData(result.data);
                } else {
                    setError("No Logistics report found.");
                }
            } catch (err) { 
                setError("Failed to communicate with the server."); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchReport();
    }, [dateRangeVal]);

    const filterArray = (arr: any) => {
        if (!arr) return [];
        let parsedArr = arr;
        if (typeof arr === 'string') {
            try { parsedArr = JSON.parse(arr); } catch { return []; }
        }
        if (!Array.isArray(parsedArr)) return [];
        if (!searchVal.trim()) return parsedArr;
        const lowerSearch = searchVal.toLowerCase();
        return parsedArr.filter(row => 
            row && Object.values(row).some(val => String(val).toLowerCase().includes(lowerSearch))
        );
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Logistics Data...</div>;
    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    if (!data) return <div className="p-8 text-center text-gray-500">No data available.</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Logistics Dashboard</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Review cement dispatch, raw material stock, and payments.</p>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    Report Date: {data.reportDate || 'N/A'}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                <GlobalFilterBar showSearch={true} searchVal={searchVal} onSearchChange={setSearchVal} showDateRange={true} />

                <div className="space-y-4">
                    <GenericJsonTable title="Cement Dispatch Area-wise (FOR)" data={filterArray(data.cementDispatchData)} />
                    <GenericJsonTable title="Raw Materials Closing Stock" data={filterArray(data.rawMaterialStockData)} />
                    <GenericJsonTable title="Transporter Payments (Daily)" data={filterArray(data.transporterPaymentData)} />
                </div>
            </CardContent>
        </Card>
    );
}