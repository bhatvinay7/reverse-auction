'use client';

import { useEffect, useState } from 'react';
import { Save, User, Building, Phone, Mail, MapPin, Truck, FileText, BadgeCheck, Camera } from 'lucide-react';
import clsx from 'clsx';
import { Toast } from '../Toast';
import { useAuth } from '../../contexts/AuthContext';

export function UserProfile() {
  const { session } = useAuth();
  const role = session?.role === 'CUSTOMER' ? 'seller' : 'bidder';
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // State for forms
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    industry: '',
    shippingVolume: '10-50 loads/month',
    dotNumber: 'US-12345678',
    fleetSize: '25-50 trucks',
    serviceAreas: 'Midwest, Northeast',
  });

  useEffect(() => {
    const fullName = localStorage.getItem('userName')?.trim() || '';
    const [firstName = '', ...rest] = fullName.split(/\s+/);
    setFormData(current => ({ ...current, firstName, lastName: rest.join(' ') }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('userName', `${formData.firstName} ${formData.lastName}`.trim());
    setToast({ message: 'Profile saved successfully!', type: 'success' });
  };

  const inputClasses = "w-full bg-white/60 dark:bg-zinc-950/40 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all hover:bg-white/80 dark:hover:bg-zinc-900/60 shadow-sm";
  const iconInputClasses = "w-full bg-white/60 dark:bg-zinc-950/40 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all hover:bg-white/80 dark:hover:bg-zinc-900/60 shadow-sm";

  return (
    <div className="mx-auto w-full max-w-4xl pb-8">
      <Toast message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900">
        
        {/* Header */}
        <div className="px-10 py-10 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center gap-6 relative">
          <div className="relative group cursor-pointer w-24 h-24 rounded-full flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full opacity-20 blur-md group-hover:opacity-40 transition-opacity duration-300"></div>
            <div className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-md">
               <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                 {formData.firstName[0] || 'A'}{formData.lastName[0] || ''}
               </span>
            </div>
            <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300">
               <Camera size={14} />
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200/50 dark:border-emerald-800/50">
               <BadgeCheck size={14} /> Verified Account
            </div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
              {formData.firstName} {formData.lastName}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5 font-medium">
              Manage your <span className="font-bold text-zinc-700 dark:text-zinc-300">{role === 'seller' ? 'Seller' : 'Bidder'}</span> account details and preferences.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-10 space-y-10 relative">
          
          {/* Section: Personal Info (Shared) */}
          <section className="bg-white/40 dark:bg-zinc-950/40 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800/50 shadow-sm">
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
              <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
                <User size={20} />
              </span>
              Personal Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">First Name</label>
                <input 
                  type="text" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Last Name</label>
                <input 
                  type="text" 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange}
                    className={iconInputClasses}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Phone Number</label>
                <div className="relative group">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange}
                    className={iconInputClasses}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Business Info (Role Specific) */}
          <section className="bg-white/40 dark:bg-zinc-950/40 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800/50 shadow-sm">
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
              <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 p-2 rounded-lg">
                <Building size={20} />
              </span>
              Business Profile
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Company Name</label>
                <div className="relative group">
                  <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input 
                    type="text" 
                    name="companyName" 
                    value={formData.companyName} 
                    onChange={handleChange}
                    className={iconInputClasses}
                  />
                </div>
              </div>

              {role === 'seller' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Industry</label>
                    <input 
                      type="text" 
                      name="industry" 
                      value={formData.industry} 
                      onChange={handleChange}
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Average Shipping Volume</label>
                    <select 
                      name="shippingVolume" 
                      value={formData.shippingVolume} 
                      onChange={handleChange}
                      className={clsx(inputClasses, "appearance-none cursor-pointer")}
                    >
                      <option>1-10 loads/month</option>
                      <option>10-50 loads/month</option>
                      <option>50-200 loads/month</option>
                      <option>200+ loads/month</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1 flex items-center gap-1.5">
                      Carrier DOT Number <BadgeCheck size={14} className="text-emerald-500" />
                    </label>
                    <div className="relative group">
                      <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text" 
                        name="dotNumber" 
                        value={formData.dotNumber} 
                        onChange={handleChange}
                        className={iconInputClasses}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Fleet Size</label>
                    <div className="relative group">
                      <Truck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      <select 
                        name="fleetSize" 
                        value={formData.fleetSize} 
                        onChange={handleChange}
                        className={clsx(iconInputClasses, "appearance-none cursor-pointer")}
                      >
                        <option>1-5 trucks</option>
                        <option>5-25 trucks</option>
                        <option>25-50 trucks</option>
                        <option>50+ trucks</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">Primary Service Areas</label>
                    <div className="relative group">
                      <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="text" 
                        name="serviceAreas" 
                        value={formData.serviceAreas} 
                        onChange={handleChange}
                        placeholder="e.g. Midwest, Southeast"
                        className={iconInputClasses}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="pt-6 flex justify-end">
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-10 rounded-xl shadow-[0_8px_30px_rgba(79,70,229,0.3)] transition-all hover:-translate-y-1 active:translate-y-0 flex items-center gap-2"
            >
              <Save size={20} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
