// src/app/dashboard/adminAppReports/purchase_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { NEXT_PUBLIC_MYCOCOSERVER_URL } from '@/lib/Reusable-constants';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PurchaseReportPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchVal, setSearchVal] = useState<string>("");

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${NEXT_PUBLIC_MYCOCOSERVER_URL}/api/purchase-reports/latest`);
                const result = await res.json();
                if (result.success && result.data) setData(result.data);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchReport();
    }, []);

    const filterArray = (arr: any[]) => {
        if (!arr || !Array.isArray(arr)) return [];
        if (!searchVal.trim()) return arr;
        return arr.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchVal.toLowerCase())));
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Purchase Data...</div>;
    if (!data) return <div className="p-8 text-center text-gray-500">No data available.</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Purchase Dashboard</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Review daily and monthly important materials and report status.</p>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    Report Date: {data.reportDate}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                <GlobalFilterBar showSearch={true} searchVal={searchVal} onSearchChange={setSearchVal} showDateRange={true} />

                <div className="space-y-4">
                    <GenericJsonTable title="Daily Materials (Top 5)" data={filterArray(data.dailyMaterials)} />
                    <GenericJsonTable title="Monthly Important Materials (Top 10)" data={filterArray(data.monthlyImportantMaterials)} />
                    <GenericJsonTable title="Report Status" data={filterArray(data.reportStatus)} />
                </div>
            </CardContent>
        </Card>
    );
}