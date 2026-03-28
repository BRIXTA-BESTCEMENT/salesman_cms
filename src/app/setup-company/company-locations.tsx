// src/app/setup-company/comapny-locations.tsx
'use client';
import * as React from 'react';
import { toast } from 'sonner';

type Locations = {
  regions: string[];
  areas: string[];
};

/**
 * Custom hook to fetch and provide dynamic company locations (regions and areas).
 */
export function useCompanyLocations() {
  const [locations, setLocations] = React.useState<Locations>({ regions: [], areas: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch(`/api/setup-company/company-locations`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Locations = await response.json();
        setLocations(data);
      } catch (e: any) {
        console.error("Failed to fetch company locations:", e);
        setError(e.message);
        toast.error("Failed to load company locations.");
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  return { locations, loading, error };
}
