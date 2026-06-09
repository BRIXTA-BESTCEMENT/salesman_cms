// src/app/dashboard/adminAppReports/finance_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function FinanceReportPage() {
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

                // If dates are provided, we fetch the filtered list. Otherwise, just fetch the latest single record.
                const endpoint = isLatest
                    ? `/api/dashboardPagesAPI/admin-app-reports/finance?action=latest`
                    : `/api/dashboardPagesAPI/admin-app-reports/finance?${params.toString()}`;

                const res = await fetch(endpoint, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = await res.json();
                
                if (result.success && result.data) {
                    // When fetching by dates, the API returns an array. We take the first/most recent match to show on the dashboard.
                    const fetchedData = Array.isArray(result.data) ? result.data[0] : result.data;
                    
                    if (fetchedData) {
                        setData(fetchedData);
                    } else {
                        setError("No finance report found for the selected criteria.");
                        setData(null);
                    }
                } else {
                    setError("No finance report found for the selected criteria.");
                    setData(null);
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

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Finance Data...</div>;
    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
    if (!data) return <div className="p-8 text-center text-gray-500">No data available.</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Finance Dashboard</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Comparing {data.detectedMonths?.current || "Current Month"} vs {data.detectedMonths?.previous || "Previous Month"}
                    </p>
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
                    <GenericJsonTable title="P&L and Balance Sheet Status" data={filterArray(data.plbsStatus)} />
                    <GenericJsonTable title="Cost Sheet - JUD" data={filterArray(data.costSheetJUD)} />
                    <GenericJsonTable title="Cost Sheet - JSB" data={filterArray(data.costSheetJSB)} />
                    <GenericJsonTable title="Investor Queries" data={filterArray(data.investorQueries)} />
                </div>
            </CardContent>
        </Card>
    );
}