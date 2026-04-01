// src/app/dashboard/teamOverview/salesmanLiveLocation.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from "react-dom/server";
import "leaflet/dist/leaflet.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserLocations } from '@/components/reusable-user-locations';
import { ORG_ROLES } from "@/lib/Reusable-constants";
import { GlobalFilterBar } from '@/components/global-filter-bar'; 
import { useDebounce } from '@/hooks/use-debounce-search';   

// --- Zod Schema Validation ---
const liveLocationSchema = z.object({
  userId: z.string(),
  salesmanName: z.string(),
  employeeId: z.string().nullable(),
  role: z.string(),
  region: z.string().nullable(),
  area: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  recordedAt: z.string(),
  isActive: z.boolean(),
  accuracy: z.number().nullable(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  altitude: z.number().nullable(),
  batteryLevel: z.number().nullable(),
});

type LiveLocationData = z.infer<typeof liveLocationSchema>;

// ============================
// Map Component
const LeafletMap = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Popup, useMap } = await import("react-leaflet");
    const L = (await import("leaflet")).default;

    // Custom DivIcon so markers always render
    const iconHtml = renderToStaticMarkup(
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-cyan-700 shadow-md border-2 border-white">
        <MapPin size={20} className="text-white" />
      </div>
    );

    const salesmanIcon = L.divIcon({
      html: iconHtml,
      className: "", // disable default leaflet styles
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });

    // Reset map size on mount
    const MapReset = () => {
      const map = useMap();
      useEffect(() => {
        if (map) map.invalidateSize();
      }, [map]);
      return null;
    };

    // Auto-fit map to markers (FIXED FOR BOUNCING)
    const FitBounds = ({ locations }: { locations: LiveLocationData[] }) => {
      const map = useMap();
      
      // We create a stable string of user IDs. 
      // This ensures the map ONLY auto-zooms when a user is added/removed (via filters or initial load),
      // and NOT when their GPS coordinates simply update in the background.
      const userIdsString = locations.map(l => l.userId).sort().join(',');

      useEffect(() => {
        if (locations.length > 0) {
          const bounds = L.latLngBounds(
            locations.map((loc) => [loc.latitude, loc.longitude])
          );
          // Set maxZoom to prevent it from zooming in uncomfortably close if only 1 user is on the map
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
      }, [userIdsString, map]); // <-- Magic Fix: Depends on the IDs, not the coordinates!
      
      return null;
    };

    const MapComponent = ({ locations }: { locations: LiveLocationData[] }) => {
      const initialPosition: [number, number] = [26.1445, 91.7362]; // Guwahati default

      return (
        <MapContainer
          center={initialPosition}
          zoom={13}
          scrollWheelZoom={true} // Enabled so users can actually zoom in/out with their mouse!
          className="w-full h-[600px] rounded-lg z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {locations.map((location) => (
            <Marker
              key={`${location.userId}-${location.recordedAt}`}
              position={[location.latitude, location.longitude]}
              icon={salesmanIcon}
            >
              <Popup>
                <div className="font-semibold text-lg">{location.salesmanName}</div>
                <div className="text-sm text-gray-600 mt-1">
                  <p><span className="font-medium">Role:</span> {location.role}</p>
                  <p><span className="font-medium">Last seen:</span> {new Date(location.recordedAt).toLocaleString()}</p>
                  <p className="mt-1">
                    ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                  </p>
                  <p><span className="font-medium">Area:</span> {location.area || "N/A"}</p>
                  <p><span className="font-medium">Region:</span> {location.region || "N/A"}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          <MapReset />
          <FitBounds locations={locations} />
        </MapContainer>
      );
    };

    return MapComponent;
  },
  { ssr: false, loading: () => <div className="w-full h-[600px] flex items-center justify-center bg-muted/20 rounded-lg animate-pulse">Loading Map...</div> }
);

// ============================
// Main Component - Logic
export function SalesmanLiveLocation() {
  const [locations, setLocations] = useState<LiveLocationData[]>([]);
  const { locations: dynamicLocations, loading: locationsLoading } = useUserLocations();

  // --- Standardized Filter State ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [roleFilter, setRoleFilter] = useState("all");
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [zoneFilters, setZoneFilters] = useState<string[]>([]);

  // Fetch from API every 8 seconds
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch(
          `/api/dashboardPagesAPI/slm-geotracking/slmLiveLocation`
        );
        if (!response.ok) throw new Error("Failed to fetch locations");

        const data = await response.json();
        const validatedData = z.array(liveLocationSchema).parse(data);
        setLocations(validatedData);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };
    
    fetchLocations(); // initial load

    const interval = setInterval(fetchLocations, 8000);
    return () => clearInterval(interval);
  }, []);

  // --- Map raw string arrays to `{ label, value }` Options ---
  const roleOptions = useMemo(() => [
    { label: 'All Roles', value: 'all' },
    ...ORG_ROLES.map(r => ({ label: r, value: r }))
  ], []);
  const zoneOptions = useMemo(() => (dynamicLocations?.regions || []).sort().map(r => ({ label: r, value: r })), [dynamicLocations]);
  const areaOptions = useMemo(() => (dynamicLocations?.areas || []).sort().map(a => ({ label: a, value: a })), [dynamicLocations]);

  // --- Client Side Filtering ---
  const filteredLocations = useMemo(() => {
    const search = debouncedSearchQuery.toLowerCase();
    
    return locations.filter((loc) => {
      const nameMatch = !search || loc.salesmanName.toLowerCase().includes(search);
      const roleMatch = roleFilter === "all" || (loc.role && loc.role === roleFilter);
      
      const areaMatch = areaFilters.length === 0 || (loc.area && areaFilters.includes(loc.area));
      const regionMatch = zoneFilters.length === 0 || (loc.region && zoneFilters.includes(loc.region));
      
      return nameMatch && roleMatch && areaMatch && regionMatch;
    });
  }, [locations, debouncedSearchQuery, roleFilter, areaFilters, zoneFilters]);


  return (
    <div className="p-6 space-y-6 w-full">
      
      {/* --- Unified Global Filter Bar --- */}
      <div className="w-full relative z-50">
        <GlobalFilterBar 
          showSearch={true}
          showRole={true}
          showZone={true}
          showArea={true}
          showDateRange={false}
          showStatus={false}

          searchVal={searchQuery}
          roleVal={roleFilter}
          zoneVals={zoneFilters}
          areaVals={areaFilters}

          roleOptions={roleOptions}
          zoneOptions={zoneOptions}
          areaOptions={areaOptions}

          onSearchChange={setSearchQuery}
          onRoleChange={setRoleFilter}
          onZoneChange={setZoneFilters}
          onAreaChange={setAreaFilters}
        />
      </div>

      {/* Map */}
      <Card className="rounded-xl shadow-lg border border-border/30 bg-card/50 backdrop-blur-lg relative z-0">
        <CardHeader>
          <CardTitle>Live Salesman Locations</CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <LeafletMap locations={filteredLocations} />
          {filteredLocations.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg shadow-sm border text-muted-foreground font-medium">
                No salesman locations found for the selected filters.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}