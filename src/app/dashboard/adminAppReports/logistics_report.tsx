// src/app/dashboard/adminAppReports/logistics_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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

                const params = new URLSearchParams();
                let isLatest = true;

                if (dateRangeVal?.from) {
                    params.append('fromDate', format(dateRangeVal.from, 'yyyy-MM-dd'));
                    isLatest = false;
                }
                if (dateRangeVal?.to) {
                    params.append('toDate', format(dateRangeVal.to, 'yyyy-MM-dd'));
                    isLatest = false;
                }

                // If dates are selected, fetch the filtered range. Otherwise, just fetch the latest.
                const endpoint = isLatest
                    ? `/api/dashboardPagesAPI/admin-app-reports/logistics?action=latest`
                    : `/api/dashboardPagesAPI/admin-app-reports/logistics?${params.toString()}`;

                const res = await fetch(endpoint);
                const result = await res.json();
                
                if (result.success && result.data) {
                    // Extract the first (most recent) match if the API returned an array based on date filters
                    const fetchedData = Array.isArray(result.data) ? result.data[0] : result.data;
                    
                    if (fetchedData) {
                        setData(fetchedData);
                    } else {
                        setError("No Logistics report found for the selected dates.");
                        setData(null);
                    }
                } else {
                    setError("No Logistics report found.");
                    setData(null);
                }
            } catch (err) { 
                setError("Failed to communicate with the server."); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchReport();
    }, [dateRangeVal]); // Triggers fetch when date range changes

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
                <GlobalFilterBar 
                    showSearch={true} 
                    searchVal={searchVal} 
                    onSearchChange={setSearchVal} 
                    showDateRange={true} 
                    dateRangeVal={dateRangeVal} 
                    onDateRangeChange={setDateRangeVal} 
                />

                <div className="space-y-4">
                    <GenericJsonTable title="Cement Dispatch Area-wise (FOR)" data={filterArray(data.cementDispatchData)} />
                    <GenericJsonTable title="Raw Materials Closing Stock" data={filterArray(data.rawMaterialStockData)} />
                    <GenericJsonTable title="Transporter Payments (Daily)" data={filterArray(data.transporterPaymentData)} />
                </div>
            </CardContent>
        </Card>
    );
}