'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react';
import { Upload, X, DollarSign, Calendar, Package, Info, Image as ImageIcon, Video, MapPin, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Toast } from '../Toast';
import { SHIPMENT_CATEGORIES } from '../../constants/shipment';
import { ForwardAuctionFormData, MediaPreview } from '../../schemas/auction';

export function NewForwardAuctionForm() {
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  
  const [formData, setFormData] = useState<ForwardAuctionFormData>({
    title: '',
    description: '',
    length: '',
    width: '',
    height: '',
    weight: '',
    location: '',
    startingPrice: '',
    detailedInformation: '',
    category: SHIPMENT_CATEGORIES[0] || 'Electronics',
    auctionEndDate: '',
  });

  const [media, setMedia] = useState<MediaPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numberFields = ['weight', 'startingPrice', 'length', 'width', 'height'];
    
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
      if (toRemove) URL.revokeObjectURL(toRemove.url);
      return filtered;
    });
  };

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
        return new Date(year as number, (month as number) - 1, day as number, hours as number, mins as number).getTime();
      };

      // Format exact fields expected by backend CreateAuctionPayload
      const payload = {
        title: data.title || 'Untitled',
        description: data.description || 'No description',
        auction_type: 'FORWARD',
        freight_type: null,
        item_category: data.category || null,
        item_condition: null,
        pickup_terms: data.detailedInformation || null,
        origin_address: data.location || 'Unknown',
        origin_lat: 0.0,
        origin_lng: 0.0,
        dest_address: null,
        dest_lat: null,
        dest_lng: null,
        pickup_date_start: null,
        pickup_date_end: null,
        auction_start_time: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        auction_end_time: new Date(parseLocalTime(data.auctionEndDate)).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        weight: Number(data.weight) || null,
        length: Number(data.length) || null,
        width: Number(data.width) || null,
        height: Number(data.height) || null,
        starting_price: Number(data.startingPrice) || null,
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
      setFormSuccess('Forward Auction Posted Successfully with media!');
      setFormError('');
      // Clear form
      setFormData({
        title: '',
        description: '',
        length: '',
        width: '',
        height: '',
        weight: '',
        location: '',
        startingPrice: '',
        detailedInformation: '',
        category: SHIPMENT_CATEGORIES[0] || 'Electronics',
        auctionEndDate: '',
      });
      setMedia([]);
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
    onError: (err: Error) => {
      setFormError(err.message || 'Error publishing auction.');
      setFormSuccess('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.auctionEndDate) {
      setFormError("Please provide an auction end date.");
      return;
    }
    const parseLocalTime = (isoString: string) => {
      const [datePart, timePart] = isoString.split('T');
      if (!datePart || !timePart) return NaN;
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, mins] = timePart.split(':').map(Number);
      return new Date(year!, month! - 1, day!, hours!, mins!).getTime();
    };

    const endTime = parseLocalTime(formData.auctionEndDate);
    const now = Date.now();
    
    if (isNaN(endTime)) {
      setFormError("Please provide a valid auction end date.");
      return;
    }
    
    if (endTime - now < 3 * 60 * 1000) {
      setFormError("Auction end time must be at least 3 minutes from now.");
      return;
    }
    
    // Validate max duration of 20 minutes (since start time is 'now' for forward auctions)
    if (endTime - now > 20 * 60 * 1000) {
      setFormError("Max auction duration is 20 minutes.");
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
      
      {/* 1. Basic Product Info */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Package className="text-blue-500" /> Product Details
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Product Title</label>
            <input required type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Abandoned 40ft Container contents" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category</label>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                {SHIPMENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Total Weight (lbs)</label>
              <input required type="number" min="0" name="weight" value={formData.weight} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Length (ft)</label>
              <input required type="number" min="0" name="length" value={formData.length} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Width (ft)</label>
              <input required type="number" min="0" name="width" value={formData.width} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Height (ft)</label>
              <input required type="number" min="0" name="height" value={formData.height} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Auction Setup & Location */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Info className="text-blue-500" /> Auction Setup
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Starting Price / Reserve ($)</label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input required type="number" min="0" step="0.01" name="startingPrice" value={formData.startingPrice} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Buyers will bid UP starting from this price.</p>
          </div>

          <div className="relative">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Current Location (Where is the item?)</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input required type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Warehouse 4, Seattle, WA" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="relative">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Auction End Date</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input required type="datetime-local" name="auctionEndDate" value={formData.auctionEndDate} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Public Description</label>
            <textarea required name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Describe the item's condition, history, etc..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"></textarea>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Additional Terms / Private Info</label>
            <textarea name="detailedInformation" value={formData.detailedInformation} onChange={handleChange} rows={5} placeholder="Pickup rules, required equipment for pickup..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"></textarea>
          </div>
        </div>
      </section>

      {/* 3. Media Upload */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <ImageIcon className="text-blue-500" /> Media & Attachments
        </h2>
        
        <div className="space-y-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-900/50"
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
      </section>

      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          disabled={submitMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 min-w-[240px] rounded-xl shadow-xl shadow-blue-500/20 transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 h-14"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              Publishing...
            </>
          ) : 'Publish Forward Auction'}
        </button>
      </div>

    </form>
  );
}
