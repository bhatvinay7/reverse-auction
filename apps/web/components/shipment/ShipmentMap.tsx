'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useJsApiLoader, GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';

interface ShipmentMapProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originAddress?: string;
  destAddress?: string;
}

const libraries: ("places")[] = ["places"];

export function ShipmentMap({ originLat, originLng, destLat, destLng, originAddress, destAddress }: ShipmentMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries
  });
  
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');

  useEffect(() => {
    const isValidOrigin = originLat !== 0 || originLng !== 0;
    const isValidDest = destLat !== 0 || destLng !== 0;

    if (isValidOrigin && isValidDest && isLoaded && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng },
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResponse(result);
          const dist = result.routes?.[0]?.legs?.[0]?.distance?.text;
          const dur = result.routes?.[0]?.legs?.[0]?.duration?.text;
          if (dist) setDistance(dist);
          if (dur) setDuration(dur);
        }
      });
    }
  }, [originLat, originLng, destLat, destLng, isLoaded]);

  return (
    <div className="printed-card rounded-xl overflow-hidden p-6 relative bg-zinc-50 dark:bg-zinc-900/20 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Live Route</h3>
      </div>

      {(originAddress || destAddress) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <MapPin size={14} className="text-emerald-500 shrink-0" />
            <span className="truncate">{originAddress || 'Origin'}</span>
          </div>
          <div className="hidden sm:block w-8 h-[1px] bg-zinc-300 dark:bg-zinc-700 shrink-0"></div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 sm:justify-end">
            <span className="truncate">{destAddress || 'Destination'}</span>
            <MapPin size={14} className="text-rose-500 shrink-0" />
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="w-full flex-1 min-h-[300px] relative bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
          {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: (originLat + destLat) / 2, lng: (originLng + destLng) / 2 }}
            zoom={4}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }
              ]
            }}
          >
            {directionsResponse ? (
              <DirectionsRenderer 
                directions={directionsResponse} 
                options={{ polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 5 } }}
              />
            ) : (
              <>
                <Marker position={{ lat: originLat, lng: originLng }} />
                <Marker position={{ lat: destLat, lng: destLng }} />
              </>
            )}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-zinc-500 font-medium">Loading Map...</div>
        )}
        </div>
        
        {directionsResponse && distance && duration && (
          <div className="p-5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-center">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Total Distance</p>
              <p className="font-black text-xl text-indigo-600 dark:text-indigo-400">{distance}</p>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Est. Travel Time</p>
              <p className="font-black text-xl text-zinc-900 dark:text-white">{duration}</p>
            </div>
            <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Traffic Delay</p>
              <p className="font-black text-xl text-emerald-500">Normal</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
