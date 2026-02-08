// src/components/reusable-user-locations.tsx
//'use client';

import { BASE_URL } from '@/lib/Reusable-constants';
import * as React from 'react';
import { toast } from 'sonner';

// Define the type for the API response
type Locations = {
  regions: string[];
  areas: string[];
};

/**
 * Custom hook to fetch and provide dynamic user locations.
 */
export function useUserLocations() {
  const [locations, setLocations] = React.useState<Locations>({ regions: [], areas: [] });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Change the API endpoint to the new route
        const response = await fetch(`/api/dashboardPagesAPI/users-and-team/users/user-locations`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Locations = await response.json();
        setLocations(data);
      } catch (e: any) {
        console.error("Failed to fetch user locations:", e);
        setError(e.message);
        toast.error("Failed to load user locations.");
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  return { locations, loading, error };
}