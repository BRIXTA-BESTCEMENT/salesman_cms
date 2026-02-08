// src/app/dashboard/teamOverview/salesmanLiveLocation.tsx

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { MapPin } from 'lucide-react';
import { renderToStaticMarkup } from "react-dom/server";
import "leaflet/dist/leaflet.css";
import { useUserLocations } from '@/components/reusable-user-locations';
import { BASE_URL } from "@/lib/Reusable-constants";

const roles = [
  "senior-manager",
  "manager",
  "assistant-manager",
  "senior-executive",
  "executive",
  "junior-executive",
];

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
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-cyan-700">
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

    // Auto-fit map to markers
    const FitBounds = ({ locations }: { locations: LiveLocationData[] }) => {
      const map = useMap();
      useEffect(() => {
        if (locations.length > 0) {
          const bounds = L.latLngBounds(
            locations.map((loc) => [loc.latitude, loc.longitude])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }, [locations, map]);
      return null;
    };

    const MapComponent = ({ locations }: { locations: LiveLocationData[] }) => {
      const initialPosition: [number, number] = [26.1445, 91.7362];

      return (
        <MapContainer
          center={initialPosition}
          zoom={13}
          scrollWheelZoom={false}
          className="w-full h-[600px] rounded-lg"
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
                <div className="text-sm text-gray-600">
                  <p>Role: {location.role}</p>
                  <p>Last seen: {new Date(location.recordedAt).toLocaleString()}</p>
                  <p>
                    Location: ({location.latitude.toFixed(4)},{" "}
                    {location.longitude.toFixed(4)})
                  </p>
                  <p>Area: {location.area || "N/A"}</p>
                  <p>Region: {location.region || "N/A"}</p>
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
  { ssr: false }
);

// ============================
// Main Component - Logic
export function SalesmanLiveLocation() {
  const [locations, setLocations] = useState<LiveLocationData[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LiveLocationData[]>([]);
  const [filters, setFilters] = useState({
    name: "",
    role: "all",
    area: "all",
    region: "all",
  });
  const { locations: dynamicLocations, loading: locationsLoading } = useUserLocations();

  // Fetch from API every 5 seconds
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch(
          `/api/dashboardPagesAPI/slm-geotracking/slmLiveLocation`
        );
        if (!response.ok) throw new Error("Failed to fetch locations");

        const data = await response.json();
        //console.log("Locations received from API:", data); 
        const validatedData = z.array(liveLocationSchema).parse(data);
        //console.log("Validated locations:", validatedData);
        setLocations(validatedData);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };
    fetchLocations(); // initial load

    const interval = setInterval(fetchLocations, 8000);
    return () => clearInterval(interval);
  }, []);

  // Apply filters
  useEffect(() => {
    const filtered = locations.filter((loc) => {
      const nameMatch =
        filters.name === "" ||
        loc.salesmanName.toLowerCase().includes(filters.name.toLowerCase());
      const roleMatch =
        filters.role === "all" ||
        (loc.role && loc.role.toLowerCase() === filters.role.toLowerCase());
      const areaMatch =
        filters.area === "all" ||
        (loc.area && loc.area.toLowerCase() === filters.area.toLowerCase());
      const regionMatch =
        filters.region === "all" ||
        (loc.region && loc.region.toLowerCase() === filters.region.toLowerCase());
      return nameMatch && roleMatch && areaMatch && regionMatch;
    });
    setFilteredLocations(filtered);
  }, [locations, filters]);

  //console.log("Filtered locations for map:", filteredLocations);
  locations.forEach((loc) =>
    console.log("Map pin:", loc.userId, loc.latitude, loc.longitude)
  );

  return (
    <div className="p-6 space-y-6">
      {/* Filters */}
      <Card className="rounded-xl shadow-lg border border-border/30 bg-card/50 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Salesman Live Location Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">

            {/* Salesman Name */}
            <div className="space-y-2">
              <Label htmlFor="salesman-name">Salesman Name</Label>
              <Input
                id="salesman-name"
                placeholder="Search by name..."
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={filters.role}
                onValueChange={(value) => setFilters({ ...filters, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="z-9999 border border-border/30 bg-popover/50 backdrop-blur-lg">
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Area */}
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Select
                value={filters.area}
                onValueChange={(value) => setFilters({ ...filters, area: value })}
              >
                <SelectTrigger id="area">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent className="z-9999 border border-border/30 bg-popover/50 backdrop-blur-lg">
                  <SelectItem value="all">All Areas</SelectItem>
                  {dynamicLocations.areas.sort().map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select
                value={filters.region}
                onValueChange={(value) => setFilters({ ...filters, region: value })}
              >
                <SelectTrigger id="region">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent className="z-9999 border border-border/30 bg-popover/50 backdrop-blur-lg">
                  <SelectItem value="all">All Regions</SelectItem>
                  {dynamicLocations.regions.sort().map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
       <Card className="rounded-xl shadow-lg border border-border/3D bg-card/50 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Live Salesman Locations</CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <LeafletMap locations={filteredLocations} />
          {filteredLocations.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500">No salesman locations found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
