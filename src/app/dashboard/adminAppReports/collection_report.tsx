// src/app/dashboard/adminAppReports/collection_report.tsx
'use client';

import { useEffect, useState } from 'react';
import { NEXT_PUBLIC_MYCOCOSERVER_URL } from '@/lib/Reusable-constants';
import { GlobalFilterBar } from '@/components/global-filter-bar';
import { GenericJsonTable } from '@/components/generic-json-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function CollectionReportPage() {
    const [dataList, setDataList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchVal, setSearchVal] = useState<string>("");

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${NEXT_PUBLIC_MYCOCOSERVER_URL}/api/collection-reports?limit=500`);
                const result = await res.json();
                if (result.success && result.data) {
                    setDataList(Array.isArray(result.data) ? result.data : []);
                }
            } catch (err) { 
                console.error(err); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchReport();
    }, []);

    const filterArray = (arr: any[]) => {
        if (!arr || !Array.isArray(arr)) return [];
        if (!searchVal.trim()) return arr;
        return arr.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchVal.toLowerCase())));
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Collection Data...</div>;

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Collection Reports (Recent)</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Review recent collection vouchers and party details.</p>
                </div>
                <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    Records: {filterArray(dataList).length}
                </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
                <GlobalFilterBar showSearch={true} searchVal={searchVal} onSearchChange={setSearchVal} showDateRange={true} />

                <div className="w-full">
                    <GenericJsonTable data={filterArray(dataList)} />
                </div>
            </CardContent>
        </Card>
    );
}