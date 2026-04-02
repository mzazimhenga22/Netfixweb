'use client';

import { Navbar } from '@/components/layout/navbar';
import { useAuth } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  Shield, 
  User, 
  Monitor, 
  ChevronRight, 
  Mail, 
  Lock, 
  Smartphone,
  Info,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function AccountPage() {
  const { user, profiles } = useAuth();

  return (
    <main className="min-h-screen bg-[#f3f3f3] text-[#333]">
      <Navbar />
      
      <div className="max-w-5xl mx-auto pt-24 sm:pt-32 px-4 pb-20">
        <h1 className="text-3xl sm:text-4xl font-medium mb-6 text-black">Account</h1>
        
        {/* Main Info Container */}
        <div className="bg-white shadow-sm border border-[#ccc] rounded-sm divide-y divide-[#eee]">
          
          {/* Membership & Billing */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] p-4 sm:p-6 gap-6">
            <div className="space-y-4">
               <h2 className="text-[#777] text-lg font-bold uppercase tracking-tight">Membership & Billing</h2>
               <Button className="w-full bg-[#e6e6e6] text-black hover:bg-[#ccc] font-bold shadow-none border-none rounded-none h-10">Cancel Membership</Button>
            </div>
            
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-black">{user?.email || 'user@example.com'}</p>
                  <p className="text-[#777]">Password: ********</p>
                  <p className="text-[#777]">Phone: 123-456-7890</p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1.5 text-[#0073e6] text-sm font-medium">
                  <Link href="/account/security" className="hover:underline">Change account email</Link>
                  <Link href="/account/security" className="hover:underline">Change password</Link>
                  <Link href="/account/security" className="hover:underline">Change phone number</Link>
                </div>
              </div>

              <div className="pt-6 border-t border-[#eee] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="p-1 px-2 border border-[#ccc] rounded text-xs font-bold uppercase">Visa</span>
                  <span className="font-bold text-black">•••• •••• •••• 4242</span>
                  <span className="text-[#777] text-sm hidden sm:inline">Next billing date: April 15, 2026</span>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1.5 text-[#0073e6] text-sm font-medium">
                  <span className="hover:underline cursor-pointer">Manage payment info</span>
                  <span className="hover:underline cursor-pointer">Add backup payment method</span>
                  <span className="hover:underline cursor-pointer">Billing details</span>
                  <span className="hover:underline cursor-pointer">Redeem gift card or promo code</span>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] p-4 sm:p-6 gap-6">
            <h2 className="text-[#777] text-lg font-bold uppercase tracking-tight">Plan Details</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <span className="font-bold text-black text-lg">Premium</span>
                  <span className="border border-[#333] px-2 py-0.5 text-[10px] font-black rounded-sm uppercase">Ultra HD</span>
                </div>
                <span className="text-[#0073e6] hover:underline cursor-pointer text-sm font-medium">Change plan</span>
            </div>
          </div>

          {/* Security & Privacy */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] p-4 sm:p-6 gap-6">
            <h2 className="text-[#777] text-lg font-bold uppercase tracking-tight">Security & Privacy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
               {[
                 'Control access to this account',
                 'Manage download devices',
                 'Activate a device',
                 'Manage access and devices',
                 'Sign out of all devices',
                 'Download your personal information'
               ].map((item) => (
                 <div key={item} className="flex items-center justify-between group cursor-pointer py-1">
                   <span className="text-[#333] group-hover:underline text-sm font-medium">{item}</span>
                   <ChevronRight className="w-4 h-4 text-[#ccc] group-hover:text-[#333]" />
                 </div>
               ))}
            </div>
          </div>

          {/* Profile & Parental Controls */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] p-4 sm:p-6 gap-6">
            <h2 className="text-[#777] text-lg font-bold uppercase tracking-tight">Profile & Parental Controls</h2>
            <div className="space-y-2">
               {profiles.map((profile) => (
                 <div key={profile.id} className="flex items-center justify-between py-4 border-b border-[#eee] last:border-0 group cursor-pointer hover:bg-[#f9f9f9] transition-colors rounded-sm px-2">
                   <div className="flex items-center gap-4">
                      <Image src={profile.avatar} alt={profile.name} width={50} height={50} className="rounded object-cover shadow-sm" />
                       <div className="space-y-0.5">
                          <p className="font-bold text-black">{profile.name}</p>
                          <p className="text-xs text-[#777]">All Maturity Ratings</p>
                       </div>
                   </div>
                    <ChevronDown className="w-5 h-5 text-[#ccc] group-hover:text-[#333] transition-transform duration-300" />
                 </div>
               ))}
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] p-4 sm:p-6 gap-6 border-b-0">
            <h2 className="text-[#777] text-lg font-bold uppercase tracking-tight">Settings</h2>
            <div className="flex flex-col gap-3">
                <Link href="/profiles/transfer" className="text-[#0073e6] hover:underline text-sm font-medium flex items-center gap-2">
                   Transfer profile
                   <ExternalLink className="w-3 h-3" />
                </Link>
                <div className="text-[#0073e6] hover:underline cursor-pointer text-sm font-medium">Test participation</div>
                <div className="text-[#0073e6] hover:underline cursor-pointer text-sm font-medium">Manage subtitle appearance</div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
