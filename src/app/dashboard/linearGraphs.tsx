// src/app/dashboard/linearGraphs.tsx
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChartAreaInteractive } from '@/components/chart-area-reusable';

import {
  RawGeoTrackingRecord, 
  RawSalesOrderReportRecord,
} from './data-format';

// --- Graph Data Types ---
type GeoTrackingData = { name: string; distance: number };
type SalesQuantityData = { name: string; quantity: number };

interface LinearGraphsProps {
  jobRoles?: string[];
  permissions?: string[];
}

export default function LinearGraphs(
  { jobRoles = [], permissions = [] }: LinearGraphsProps
) {
  const [rawGeoTrackingRecords, setRawGeoTrackingRecords] = useState<RawGeoTrackingRecord[]>([]);
  const [rawSalesOrders, setRawSalesOrders] = useState<RawSalesOrderReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSalesman] = useState<string | 'all'>('all');

  const isAdmin = permissions.includes('ALL_ACCESS');
  const canViewSales = isAdmin || jobRoles.some(r => ['Accounting'].includes(r));
  const canViewGeo = isAdmin || jobRoles.some(r => ['Sales-Marketing', 'Technical-Sales', 'Reports-MIS'].includes(r));

  const fetchData = useCallback(async () => {
    // If the user has access to neither, skip fetching entirely
    if (!canViewGeo && !canViewSales) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fetchPromises = [];

      // Conditionally fetch ONLY what the user is allowed to see
      if (canViewGeo) {
        fetchPromises.push(
          fetch(`/api/dashboardPagesAPI/slm-geotracking?pageSize=1000`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setRawGeoTrackingRecords(data.data || []))
        );
      }

      if (canViewSales) {
        fetchPromises.push(
          fetch(`/api/dashboardPagesAPI/reports/sales-orders?pageSize=1000`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => setRawSalesOrders(data.data || []))
        );
      }

      await Promise.all(fetchPromises);
    } catch (err: any) {
      console.error("Dashboard Graphs Error:", err);
      setError(err.message || "Failed to load dashboard data");
      toast.error("Failed to load some dashboard charts");
    } finally {
      setLoading(false);
    }
  }, [canViewGeo, canViewSales]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const geoGraphData: GeoTrackingData[] = useMemo(() => {
    if (!canViewGeo) return [];
    let filtered = rawGeoTrackingRecords;
    if (selectedSalesman !== 'all') filtered = filtered.filter(r => r.salesmanName === selectedSalesman);

    const agg: Record<string, number> = {};
    filtered.forEach(item => {
      const dateStr = item.recordedAt || item.createdAt;
      if (!dateStr) return;

      const key = new Date(dateStr).toISOString().slice(0, 10);
      agg[key] = (agg[key] || 0) + (item.totalDistanceTravelled ?? 0);
    });
    return Object.keys(agg).sort().map(k => ({ name: k, distance: agg[k] }));
  }, [rawGeoTrackingRecords, selectedSalesman, canViewGeo]);

  const salesQuantityGraphData: SalesQuantityData[] = useMemo(() => {
    if (!canViewSales) return [];
    let filtered = rawSalesOrders;
    if (selectedSalesman !== 'all') filtered = filtered.filter(r => r.salesmanName === selectedSalesman);
    const agg: Record<string, number> = {};
    filtered.forEach(item => {
      const key = item.orderDate;
      const qty = item.orderQty ?? 0;
      agg[key] = (agg[key] || 0) + (isNaN(qty) ? 0 : qty);
    });
    return Object.keys(agg).sort().map(k => ({ name: k, quantity: agg[k] }));
  }, [rawSalesOrders, selectedSalesman, canViewSales]);

  if (!canViewGeo && !canViewSales) return null; // Render nothing if they have no access

  if (loading) return <div className="flex justify-center items-center min-h-[300px]">Loading graph data...</div>;
  if (error)
    return (
      <div className="text-center text-red-500 py-8 border rounded-lg bg-card">
        Error: {error}
        <Button onClick={fetchData} className="ml-4">Retry</Button>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Dynamic Grid Layout based on permissions */}
      <div className={`grid grid-cols-1 ${canViewGeo && canViewSales ? 'md:grid-cols-2' : ''} gap-6`}>

        {/* Geo-Tracking Widget */}
        {canViewGeo && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Geo-Tracking Activity</CardTitle>
              <CardDescription>Total distance travelled per day (km).</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartAreaInteractive data={geoGraphData} dataKey="distance" title="Distance Travelled" />
            </CardContent>
          </Card>
        )}

        {/* Sales Quantity Widget */}
        {canViewSales && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Sales Order Quantity</CardTitle>
              <CardDescription>Total unit quantity ordered per day.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartAreaInteractive data={salesQuantityGraphData} dataKey="quantity" title="Sales (Units)" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}