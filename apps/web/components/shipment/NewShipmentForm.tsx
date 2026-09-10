'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react';
import { useJsApiLoader, StandaloneSearchBox, GoogleMap, DirectionsRenderer } from '@react-google-maps/api';
import { Package, MapPin, Calendar, Truck, Navigation, Info, DollarSign, Image as ImageIcon, Upload, Video, X, Loader2, ChevronDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Toast } from '../Toast';

const libraries: ("places")[] = ["places"];

import { SHIPMENT_CATEGORIES, TIME_TO_DELIVER_OPTIONS } from '../../constants/shipment';

interface ShipmentFormData {
  title: string;
  description: string;
  length: string | number;
  width: string | number;
  height: string | number;
  weight: string | number;
  origin: string;
  originLat: number;
  originLng: number;
  destination: string;
  destLat: number;
  destLng: number;
  initialAmount: string | number;
  detailedInformation: string;
  category: string;
  timeToDeliver: string;
  pickupDate: string;
  auctionStartTime: string;
  auctionEndTime: string;
}

interface MediaPreview {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
}

export function NewShipmentForm() {
  const [formData, setFormData] = useState<ShipmentFormData>({
    title: '',
    description: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    origin: '',
    originLat: 0.0,
    originLng: 0.0,
    destination: '',
    destLat: 0.0,
    destLng: 0.0,
    initialAmount: '',
    detailedInformation: '',
    category: SHIPMENT_CATEGORIES[0] || 'Electronics',
    timeToDeliver: TIME_TO_DELIVER_OPTIONS[0] || 'Same Day',
    pickupDate: '',
    auctionStartTime: '',
    auctionEndTime: '',
  });

  const [media, setMedia] = useState<MediaPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  const [collapsed, setCollapsed] = useState({
    freight: false,
    route: false,
    details: false,
    media: false,
  });

  const toggleCollapse = (section: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries
  });

  const [originSearchBox, setOriginSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [destSearchBox, setDestSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const isValidOrigin = formData.origin && formData.origin !== 'Unknown' && formData.origin.length > 3;
    const isValidDest = formData.destination && formData.destination !== 'Unknown' && formData.destination.length > 3;

    if (isValidOrigin && isValidDest && isLoaded && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: formData.origin,
        destination: formData.destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResponse(result);
          setDistance(result.routes?.[0]?.legs?.[0]?.distance?.text || '');
          setDuration(result.routes?.[0]?.legs?.[0]?.duration?.text || '');
        }
      });
    }
  }, [formData.origin, formData.destination, isLoaded]);

  const onOriginPlacesChanged = () => {
    if (originSearchBox) {
      const places = originSearchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        setFormData(prev => ({ 
          ...prev, 
          origin: place?.formatted_address || place?.name || '',
          originLat: place?.geometry?.location?.lat() || 0.0,
          originLng: place?.geometry?.location?.lng() || 0.0,
        }));
      }
    }
  };

  const onDestPlacesChanged = () => {
    if (destSearchBox !== null) {
      const places = destSearchBox.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        setFormData(prev => ({
          ...prev,
          destination: place?.formatted_address || place?.name || '',
          destLat: place?.geometry?.location?.lat() || 0.0,
          destLng: place?.geometry?.location?.lng() || 0.0,
        }));
      }
    }
  };

  const setAuctionDuration = (minutes: number) => {
    if (!formData.auctionStartTime) return;
    
    // Safely parse YYYY-MM-DDTHH:mm to local Date without relying on browser ISO quirks
    const [datePart, timePart] = formData.auctionStartTime.split('T');
    if (!datePart || !timePart) return;
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, mins] = timePart.split(':').map(Number);
    const startDate = new Date(year!, month! - 1, day!, hours!, mins!);
    
    if (isNaN(startDate.getTime())) return;
    
    const endTime = new Date(startDate.getTime() + minutes * 60 * 1000);
    
    // Safely format back to YYYY-MM-DDTHH:mm
    const endYear = endTime.getFullYear();
    const endMonth = String(endTime.getMonth() + 1).padStart(2, '0');
    const endDay = String(endTime.getDate()).padStart(2, '0');
    const endHours = String(endTime.getHours()).padStart(2, '0');
    const endMins = String(endTime.getMinutes()).padStart(2, '0');
    const localISOTime = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMins}`;
    
    setFormData(prev => ({ ...prev, auctionEndTime: localISOTime }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numberFields = ['weight', 'initialAmount', 'length', 'width', 'height'];
    
    let parsedValue: string | number = value;
    if (numberFields.includes(name)) {
      // Remove leading zeros if not decimal
      parsedValue = value.replace(/^0+(?=\d)/, '');
      if (parsedValue === '') parsedValue = '';
    }
    
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => {
        const isVideo = file.type.startsWith('video/');
        return {
          id: Math.random().toString(36).substring(7),
          file,
          url: URL.createObjectURL(file),
          type: isVideo ? 'video' : 'image'
        } as MediaPreview;
      });
      setMedia(prev => [...prev, ...newFiles]);
    }
  };

  const removeMedia = (id: string) => {
    setMedia(prev => {
      const filtered = prev.filter(m => m.id !== id);
      const toRemove = prev.find(m => m.id === id);
      if (toRemove) URL.revokeObjectURL(toRemove.url); // Cleanup memory
      return filtered;
    });
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      media.forEach(m => URL.revokeObjectURL(m.url));
    };
  }, [media]);

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const uploadedMediaUrls: string[] = [];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

      for (const item of media) {
        const formData = new FormData();
        formData.append('file', item.file);

        const res = await fetch(`${apiUrl}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData,
        });

        if (res.ok) {
          const resData = (await res.json()) as { secure_url: string };
          uploadedMediaUrls.push(resData.secure_url);
        } else {
          throw new Error('Failed to upload media');
        }
      }

      const parseLocalTime = (isoString: string) => {
        const [datePart, timePart] = isoString.split('T');
        if (!datePart || !timePart) return NaN;
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, mins] = timePart.split(':').map(Number);
        return new Date(year!, month! - 1, day!, hours!, mins!).getTime();
      };

      // Format exact fields expected by backend CreateAuctionPayload
      const payload = {
        title: data.title || 'Untitled',
        description: data.description || 'No description',
        auction_type: 'REVERSE',
        freight_type: null,
        item_category: data.category || null,
        pickup_terms: data.detailedInformation || null,
        origin_address: data.origin || 'Unknown',
        origin_lat: data.originLat,
        origin_lng: data.originLng,
        dest_address: data.destination || 'Unknown',
        dest_lat: data.destLat,
        dest_lng: data.destLng,
        pickup_date_start: new Date(data.pickupDate).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        pickup_date_end: new Date(data.pickupDate).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        auction_start_time: new Date(parseLocalTime(data.auctionStartTime)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        auction_end_time: new Date(parseLocalTime(data.auctionEndTime)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        weight: Number(data.weight) || null,
        length: Number(data.length) || null,
        width: Number(data.width) || null,
        height: Number(data.height) || null,
        starting_price: Number(data.initialAmount) || null,
        minimum_bid_step: 1,
        media_urls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : null,
      };

      const res = await fetch(`${apiUrl}/api/auction/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMessage = 'Failed to publish auction';
        try {
          const errData = await res.json();
          if (errData.error) errMessage = errData.error;
        } catch {
          // keep default
        }
        throw new Error(errMessage);
      }

      return await res.json();
    },
    onSuccess: () => {
      setFormSuccess('Shipment Posted Successfully with media!');
      setFormError('');
      // Clear form
      setFormData({
        title: '',
        description: '',
        length: '',
        width: '',
        height: '',
        weight: '',
        origin: '',
        originLat: 0.0,
        originLng: 0.0,
        destination: '',
        destLat: 0.0,
        destLng: 0.0,
        initialAmount: '',
        detailedInformation: '',
        category: SHIPMENT_CATEGORIES[0] || 'Electronics',
        timeToDeliver: TIME_TO_DELIVER_OPTIONS[0] || 'Same Day',
        pickupDate: '',
        auctionStartTime: '',
        auctionEndTime: '',
      });
      setMedia([]);
      setDirectionsResponse(null);
      setDistance('');
      setDuration('');
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Error publishing shipment.');
      setFormSuccess('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    if (!formData.pickupDate) {
      setFormError("Please provide a pickup date.");
      return;
    }

    const parseLocalTime = (isoString: string) => {
      const [datePart, timePart] = isoString.split('T');
      if (!datePart || !timePart) return NaN;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, mins] = timePart.split(':').map(Number);
      return new Date(year!, month! - 1, day!, hours!, mins!).getTime();
    };

    const startTime = parseLocalTime(formData.auctionStartTime);
    const endTime = parseLocalTime(formData.auctionEndTime);
    const now = Date.now();

    if (isNaN(startTime) || isNaN(endTime)) {
      setFormError("Please provide valid auction start and end times.");
      return;
    }

    if (startTime - now < 3 * 60 * 1000) {
      setFormError("Auction start time must be at least 3 minutes from now. (Cannot modify within 3 minutes of start)");
      return;
    }

    if (endTime - startTime < 5 * 60 * 1000) {
      setFormError("Auction duration must be at least 5 minutes.");
      return;
    }

    if (endTime <= startTime) {
      setFormError("Auction end time must be after the start time.");
      return;
    }

    submitMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-20">
      
      <Toast 
        message={formError} 
        type="error" 
        onClose={() => setFormError('')} 
      />
      <Toast 
        message={formSuccess} 
        type="success" 
        onClose={() => setFormSuccess('')} 
      />

      {/* 1. Basic Info & Category */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <button type="button" onClick={() => toggleCollapse('freight')} className="w-full flex items-center justify-between group">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Package className="text-indigo-500" /> Freight / Load Details
          </h2>
          <ChevronDown className={`text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform ${collapsed.freight ? '-rotate-90' : ''}`} />
        </button>
        
        {!collapsed.freight && (
        <div className="space-y-6 mt-6">
          
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Shipment Title / Short Description</label>
            <input required minLength={3} type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. 2x CNC Milling Centers" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Shipment Category</label>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                {SHIPMENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Total Weight (lbs)</label>
              <input required type="number" min="0" name="weight" value={formData.weight} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Length (ft)</label>
              <input required type="number" min="0" name="length" value={formData.length} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Width (ft)</label>
              <input required type="number" min="0" name="width" value={formData.width} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Height (ft)</label>
              <input required type="number" min="0" name="height" value={formData.height} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
            </div>
          </div>
        </div>
        )}
      </section>

      {/* 2. Routing & Logistics (WITH MAP) */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <button type="button" onClick={() => toggleCollapse('route')} className="w-full flex items-center justify-between group">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <MapPin className="text-indigo-500" /> Route & Logistics
          </h2>
          <ChevronDown className={`text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform ${collapsed.route ? '-rotate-90' : ''}`} />
        </button>
        
        {!collapsed.route && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
          
          {/* Left Column: Location Inputs */}
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Origin (Place A)</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 z-10" />
                {isLoaded ? (
                  <StandaloneSearchBox onLoad={setOriginSearchBox} onPlacesChanged={onOriginPlacesChanged}>
                    <input required type="text" name="origin" value={formData.origin} onChange={handleChange} placeholder="e.g. Seattle, WA" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
                  </StandaloneSearchBox>
                ) : (
                  <input required type="text" name="origin" value={formData.origin} onChange={handleChange} placeholder="Loading map..." disabled className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors opacity-70" />
                )}
              </div>
            </div>
            
            <div className="relative">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Destination (Place B)</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 z-10" />
                {isLoaded ? (
                  <StandaloneSearchBox onLoad={setDestSearchBox} onPlacesChanged={onDestPlacesChanged}>
                    <input required type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="e.g. Miami, FL" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
                  </StandaloneSearchBox>
                ) : (
                  <input required type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="Loading map..." disabled className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors opacity-70" />
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Pickup Date</label>
                <div className="relative group">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                  <input required type="date" name="pickupDate" value={formData.pickupDate} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Time to Deliver</label>
                <div className="relative">
                  <Truck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <select name="timeToDeliver" value={formData.timeToDeliver} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
                    {TIME_TO_DELIVER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Auction Start Time</label>
                <div className="relative group">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                  <input required type="datetime-local" name="auctionStartTime" value={formData.auctionStartTime} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Auction End Time</label>
                <div className="relative group mb-2">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                  <input required type="datetime-local" name="auctionEndTime" value={formData.auctionEndTime} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                </div>
                {/* Duration Quick Selects */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAuctionDuration(10)} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-200 dark:hover:border-indigo-500/50 rounded-md transition-all active:scale-95">10 Min</button>
                  <button type="button" onClick={() => setAuctionDuration(15)} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-200 dark:hover:border-indigo-500/50 rounded-md transition-all active:scale-95">15 Min</button>
                  <button type="button" onClick={() => setAuctionDuration(20)} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-200 dark:hover:border-indigo-500/50 rounded-md transition-all active:scale-95">20 Min</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Google Map Route Preview */}
          <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {directionsResponse && isLoaded ? (
              <>
                <div className="flex-1 relative min-h-[300px] lg:min-h-[auto] bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      styles: [
                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                      ], // basic dark theme
                    }}
                  >
                    <DirectionsRenderer 
                      directions={directionsResponse}
                      options={{
                        polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 5 }
                      }}
                    />
                  </GoogleMap>
                  
                  <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-black/5 dark:border-white/10 flex items-center gap-1.5 text-zinc-900 dark:text-white">
                    <Navigation size={12} className="text-indigo-500" />
                    Route Connected
                  </div>
                </div>
                
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
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-8 text-center min-h-[250px]">
                 <MapPin size={36} className="mb-3 opacity-30" />
                 <p className="font-bold text-sm text-zinc-500 dark:text-zinc-400">Map Preview Disabled</p>
                 <p className="text-xs mt-1 max-w-[200px]">Select both Origin and Destination to calculate route distance and estimated time.</p>
              </div>
            )}
          </div>

        </div>
        )}
      </section>

      {/* 3. Description & Initial Amount */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <button type="button" onClick={() => toggleCollapse('details')} className="w-full flex items-center justify-between group">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Info className="text-indigo-500" /> Shipment Details & Pricing
          </h2>
          <ChevronDown className={`text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform ${collapsed.details ? '-rotate-90' : ''}`} />
        </button>
        
        {!collapsed.details && (
        <div className="space-y-6 mt-6">
          <div className="relative">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Initial Starting Amount ($)</label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input required type="number" min="0" step="0.01" name="initialAmount" value={formData.initialAmount} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">This is the maximum amount you are willing to pay. Carriers will bid down from this amount.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Public Description</label>
            <textarea required minLength={5} name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Brief summary of the freight..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"></textarea>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Detailed Information (Private to bidders)</label>
            <textarea name="detailedInformation" value={formData.detailedInformation} onChange={handleChange} rows={5} placeholder="Special instructions, loading dock info, tarping requirements..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"></textarea>
          </div>
        </div>
        )}
      </section>

      {/* 4. Media Upload (Photos & Videos) */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <button type="button" onClick={() => toggleCollapse('media')} className="w-full flex items-center justify-between group">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <ImageIcon className="text-indigo-500" /> Media & Attachments
          </h2>
          <ChevronDown className={`text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform ${collapsed.media ? '-rotate-90' : ''}`} />
        </button>
        
        {!collapsed.media && (
        <div className="space-y-4 mt-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-900/50"
          >
            <input 
              type="file" 
              multiple 
              accept="image/*,video/*"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Upload size={32} className="mx-auto text-zinc-400 mb-3" />
            <p className="text-zinc-700 dark:text-zinc-300 font-semibold mb-1">Click to upload photos or videos</p>
            <p className="text-zinc-500 dark:text-zinc-500 text-sm">Drag and drop is supported. Max file size 50MB.</p>
          </div>

          {/* Media Previews */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
              {media.map((item) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-square bg-zinc-100 dark:bg-zinc-900">
                  {item.type === 'image' ? (
                    <img src={item.url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="relative w-full h-full bg-black flex items-center justify-center">
                      <video src={item.url} preload="metadata" className="w-full h-full object-contain" />
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white p-1 rounded">
                        <Video size={14} />
                      </div>
                    </div>
                  )}
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeMedia(item.id); }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          disabled={submitMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 min-w-[240px] rounded-xl shadow-xl shadow-indigo-500/20 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 h-14"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              Publishing...
            </>
          ) : 'Publish Reverse Auction'}
        </button>
      </div>

    </form>
  );
}
