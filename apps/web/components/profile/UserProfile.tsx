'use client';

import { useState } from 'react';
import { Save, User, Building, Phone, Mail, MapPin, Truck, FileText, BadgeCheck } from 'lucide-react';
import clsx from 'clsx';

type Role = 'seller' | 'bidder';

export function UserProfile() {
  const [role, setRole] = useState<Role>('seller');
  
  // State for forms
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    companyName: 'Acme Logistics',
    industry: 'Manufacturing',
    shippingVolume: '10-50 loads/month',
    dotNumber: 'US-12345678',
    fleetSize: '25-50 trucks',
    serviceAreas: 'Midwest, Northeast',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    alert('Profile saved successfully!');
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Role Toggle for Demo Purposes */}
      <div className="flex justify-end mb-8">
        <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 flex shadow-sm">
          <button
            onClick={() => setRole('seller')}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-semibold transition-colors",
              role === 'seller' ? "bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            )}
          >
            View as Seller
          </button>
          <button
            onClick={() => setRole('bidder')}
            className={clsx(
              "px-4 py-1.5 rounded-md text-sm font-semibold transition-colors",
              role === 'bidder' ? "bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            )}
          >
            View as Bidder (Carrier)
          </button>
        </div>
      </div>

      <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <User size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Profile Settings</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              Manage your {role === 'seller' ? 'Shipper' : 'Carrier'} account details and public information.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          
          {/* Section: Personal Info (Shared) */}
          <section>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <User size={18} className="text-indigo-500" /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">First Name</label>
                <input 
                  type="text" 
                  name="firstName" 
                  value={formData.firstName} 
                  onChange={handleChange}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Last Name</label>
                <input 
                  type="text" 
                  name="lastName" 
                  value={formData.lastName} 
                  onChange={handleChange}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section: Business Info (Role Specific) */}
          <section>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Building size={18} className="text-indigo-500" /> Business Profile
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Company Name</label>
                <input 
                  type="text" 
                  name="companyName" 
                  value={formData.companyName} 
                  onChange={handleChange}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {role === 'seller' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Industry</label>
                    <input 
                      type="text" 
                      name="industry" 
                      value={formData.industry} 
                      onChange={handleChange}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Average Shipping Volume</label>
                    <select 
                      name="shippingVolume" 
                      value={formData.shippingVolume} 
                      onChange={handleChange}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      Carrier DOT Number <BadgeCheck size={14} className="text-emerald-500" />
                    </label>
                    <div className="relative">
                      <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input 
                        type="text" 
                        name="dotNumber" 
                        value={formData.dotNumber} 
                        onChange={handleChange}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Fleet Size</label>
                    <div className="relative">
                      <Truck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <select 
                        name="fleetSize" 
                        value={formData.fleetSize} 
                        onChange={handleChange}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option>1-5 trucks</option>
                        <option>5-25 trucks</option>
                        <option>25-50 trucks</option>
                        <option>50+ trucks</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Primary Service Areas</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input 
                        type="text" 
                        name="serviceAreas" 
                        value={formData.serviceAreas} 
                        onChange={handleChange}
                        placeholder="e.g. Midwest, Southeast"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 transition-transform active:scale-95 flex items-center gap-2"
            >
              <Save size={18} /> Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
