'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, DollarSign, Calendar, Package, Info, Image as ImageIcon, Video, MapPin } from 'lucide-react';
import { SHIPMENT_CATEGORIES } from '../../constants/shipment';
import { ForwardAuctionFormData, MediaPreview } from '../../schemas/shipment';

export function NewForwardAuctionForm() {
  const [formData, setFormData] = useState<ForwardAuctionFormData>({
    title: '',
    description: '',
    length: 0,
    width: 0,
    height: 0,
    weight: 0,
    location: '',
    startingPrice: 0,
    detailedInformation: '',
    category: SHIPMENT_CATEGORIES[0],
    auctionEndDate: '',
  });

  const [media, setMedia] = useState<MediaPreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numberFields = ['weight', 'startingPrice', 'length', 'width', 'height'];
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
      if (toRemove) URL.revokeObjectURL(toRemove.url);
      return filtered;
    });
  };

  useEffect(() => {
    return () => {
      media.forEach(m => URL.revokeObjectURL(m.url));
    };
  }, [media]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting Forward Auction:', formData);
    console.log('With Media:', media);
    alert('Forward Auction Posted Successfully! Redirecting to dashboard...');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-20">
      
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

      {/* Submit */}
      <div className="flex justify-end pt-4">
        <button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl shadow-xl shadow-blue-500/20 transition-transform active:scale-95 text-lg"
        >
          Publish Forward Auction
        </button>
      </div>

    </form>
  );
}
