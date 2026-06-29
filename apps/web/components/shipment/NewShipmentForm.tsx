'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, MapPin, DollarSign, Calendar, Truck, Package, Info, FileText, Image as ImageIcon, Video, Navigation } from 'lucide-react';
import { SHIPMENT_CATEGORIES, TIME_TO_DELIVER_OPTIONS } from '../../constants/shipment';
import { ShipmentFormData, MediaPreview } from '../../schemas/shipment';

export function NewShipmentForm() {
  const [formData, setFormData] = useState<ShipmentFormData>({
    title: '',
    description: '',
    length: 0,
    width: 0,
    height: 0,
    weight: 0,
    origin: '',
    destination: '',
    initialAmount: 0,
    detailedInformation: '',
    category: SHIPMENT_CATEGORIES[0],
    timeToDeliver: TIME_TO_DELIVER_OPTIONS[0],
    pickupDate: '',
  });

  const [media, setMedia] = useState<MediaPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numberFields = ['weight', 'initialAmount', 'length', 'width', 'height'];
    setFormData(prev => ({ ...prev, [name]: numberFields.includes(name) ? Number(value) : value }));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting Shipment:', formData);
    console.log('With Media:', media);
    alert('Shipment Posted Successfully! Redirecting to dashboard...');
  };

  // Generate a mock distance based on the length of origin and destination strings to make it "dynamic"
  const showMap = formData.origin.length > 2 && formData.destination.length > 2;
  const mockDistance = Math.abs(formData.origin.length - formData.destination.length) * 125 + 320;
  const mockHours = Math.floor(mockDistance / 60);
  const mockMinutes = Math.floor((mockDistance % 60));
  const mockTraffic = Math.floor((mockDistance % 30) + 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-20">
      
      {/* 1. Basic Info & Category */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Package className="text-indigo-500" /> Freight / Load Details
        </h2>
        
        <div className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Shipment Title / Short Description</label>
            <input required type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. 2x CNC Milling Centers" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
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
      </section>

      {/* 2. Routing & Logistics (WITH MAP) */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <MapPin className="text-indigo-500" /> Route & Logistics
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Location Inputs */}
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Origin (Place A)</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input required type="text" name="origin" value={formData.origin} onChange={handleChange} placeholder="e.g. Seattle, WA" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
            </div>
            
            <div className="relative">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Destination (Place B)</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input required type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="e.g. Miami, FL" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Target Pickup Date</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input required type="date" name="pickupDate" value={formData.pickupDate} onChange={handleChange} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
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
          </div>

          {/* Right Column: Google Map Route Preview */}
          <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {showMap ? (
              <>
                <div className="flex-1 relative min-h-[200px] lg:min-h-[auto] bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  {/* Google Map Mockup Image (Dark/Light mode responsive) */}
                  <div className="absolute inset-0 bg-cover bg-center opacity-80 dark:opacity-60 dark:invert transition-opacity" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80')" }}></div>
                  <div className="absolute inset-0 bg-indigo-900/10 dark:bg-indigo-900/40 mix-blend-multiply dark:mix-blend-color"></div>
                  
                  {/* Route Line Mockup */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-lg" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M 20,80 Q 50,50 80,20" fill="none" stroke="currentColor" strokeWidth="3" className="text-indigo-600 dark:text-indigo-400" strokeDasharray="4 4" />
                    <circle cx="20" cy="80" r="4" fill="currentColor" className="text-indigo-600 dark:text-indigo-400" />
                    <circle cx="80" cy="20" r="4" fill="currentColor" className="text-emerald-500" />
                  </svg>
                  
                  <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-black/5 dark:border-white/10 flex items-center gap-1.5 text-zinc-900 dark:text-white">
                    <Navigation size={12} className="text-indigo-500" />
                    Route Generated
                  </div>
                </div>
                
                {/* Distance & Time Metrics */}
                <div className="p-5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-center">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Total Distance</p>
                    <p className="font-black text-xl text-indigo-600 dark:text-indigo-400">{mockDistance} mi</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Est. Travel Time</p>
                    <p className="font-black text-xl text-zinc-900 dark:text-white">{mockHours}h {mockMinutes}m</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-2"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Traffic Delay</p>
                    <p className="font-black text-xl text-orange-500">+{mockTraffic}m</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-8 text-center min-h-[250px]">
                 <MapPin size={36} className="mb-3 opacity-30" />
                 <p className="font-bold text-sm text-zinc-500 dark:text-zinc-400">Map Preview Disabled</p>
                 <p className="text-xs mt-1 max-w-[200px]">Enter both Origin and Destination to calculate route distance and estimated time.</p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* 3. Description & Initial Amount */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <Info className="text-indigo-500" /> Shipment Details & Pricing
        </h2>
        
        <div className="space-y-6">
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
            <textarea required name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Brief summary of the freight..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"></textarea>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Detailed Information (Private to bidders)</label>
            <textarea name="detailedInformation" value={formData.detailedInformation} onChange={handleChange} rows={5} placeholder="Special instructions, loading dock info, tarping requirements..." className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"></textarea>
          </div>
        </div>
      </section>

      {/* 4. Media Upload (Photos & Videos) */}
      <section className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 md:p-8 transition-colors">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 flex items-center gap-2">
          <ImageIcon className="text-indigo-500" /> Media & Attachments
        </h2>
        
        <div className="space-y-4">
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
      </section>

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl shadow-xl shadow-indigo-500/20 transition-transform active:scale-95 text-lg"
        >
          Publish Reverse Auction
        </button>
      </div>

    </form>
  );
}
