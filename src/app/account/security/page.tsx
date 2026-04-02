'use client';

import { Navbar } from '@/components/layout/navbar';
import { useAuth } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { Shield, ChevronRight, Mail, Lock, Smartphone, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SecurityPage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[#f3f3f3] text-[#333]">
      <Navbar />
      
      <div className="max-w-4xl mx-auto pt-24 sm:pt-32 px-4 pb-20">
        <Link href="/account" className="flex items-center gap-1 text-[#0073e6] hover:underline mb-8 font-black text-sm uppercase tracking-wider animate-in fade-in slide-in-from-left-2 duration-500">
          <ChevronLeft className="w-5 h-5" />
          Back to Account
        </Link>
        
        <h1 className="text-3xl sm:text-5xl font-black mb-10 text-black tracking-tight">Security</h1>
        
        <div className="bg-white shadow-xl border border-[#ccc] rounded-sm divide-y divide-[#eee] animate-in fade-in zoom-in duration-700">
           
           <div className="p-6 sm:p-10 space-y-10">
              <div className="flex items-start gap-4 sm:gap-8">
                 <div className="w-14 h-14 bg-[#f8f8f8] rounded-full flex items-center justify-center flex-shrink-0 shadow-inner border border-[#eee]">
                    <Shield className="w-7 h-7 text-primary" />
                 </div>
                 <div className="space-y-1.5 pt-1">
                    <h2 className="text-2xl font-black text-black leading-tight">Account Security</h2>
                    <p className="text-[#666] font-medium leading-relaxed max-w-md">Manage your sign-in information and ensure your account access is always protected.</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                 {[
                   { icon: Mail, label: 'Email Address', value: user?.email || 'user@example.com', action: 'Update email' },
                   { icon: Lock, label: 'Password', value: '********', action: 'Update password' },
                   { icon: Smartphone, label: 'Phone', value: '123-456-7890', action: 'Update phone' },
                 ].map((item) => (
                   <div key={item.label} className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-[#fafafa] border border-[#eee] rounded-lg hover:border-[#ccc] hover:shadow-md transition-all cursor-pointer">
                      <div className="flex items-center gap-6">
                         <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm border border-[#eee]">
                            <item.icon className="w-5 h-5 text-[#333]" />
                         </div>
                         <div className="space-y-0.5">
                            <p className="text-[10px] text-[#999] font-black uppercase tracking-[0.15em] mb-0.5">{item.label}</p>
                            <p className="text-black font-bold text-lg">{item.value}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#0073e6] text-sm font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform sm:mt-0 mt-4">
                         {item.action}
                         <ChevronRight className="w-5 h-5" />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="p-6 sm:p-10 space-y-8 bg-white">
              <h3 className="text-xl font-black text-black border-l-[6px] border-primary pl-5 uppercase tracking-tighter">Account Access Control</h3>
              <div className="grid grid-cols-1 divide-y divide-[#eee]">
                 {[
                   'Manage access and devices',
                   'Sign out of all devices',
                   'Recent account access',
                   'Turn on 2-step verification'
                 ].map((item) => (
                   <div key={item} className="flex items-center justify-between py-5 group cursor-pointer transition-colors hover:bg-[#fafafa] px-2 rounded-sm ml-[-8px]">
                      <span className="text-[#333] group-hover:text-black font-black text-lg transition-colors">{item}</span>
                      <ChevronRight className="w-6 h-6 text-[#ddd] group-hover:text-black transform group-hover:translate-x-1 transition-all" />
                   </div>
                 ))}
              </div>
           </div>

        </div>

        <div className="mt-20 text-center text-xs text-[#999] max-w-lg mx-auto py-8 border-t border-[#eee]">
           Looking for data privacy settings? Visit the <span className="underline cursor-pointer font-bold hover:text-black">Privacy Center</span>. Need immediate help? <span className="underline cursor-pointer font-bold hover:text-black">Contact Netflix support</span>.
        </div>
      </div>
    </main>
  );
}
