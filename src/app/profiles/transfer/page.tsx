'use client';

import { Navbar } from '@/components/layout/navbar';
import { useAuth } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { ArrowRight, Info, ShieldCheck, UserPlus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function TransferProfilePage() {
  const { selectedProfile } = useAuth();

  return (
    <main className="min-h-screen bg-white text-[#333]">
      <Navbar />
      
      <div className="max-w-2xl mx-auto pt-32 px-6 pb-20 flex flex-col items-center animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="w-20 h-20 bg-[#e50914] rounded-full flex items-center justify-center mb-10 shadow-2xl">
           <UserPlus className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-black text-center mb-6 tracking-tight text-black">Transfer Profile</h1>
        
        <p className="text-xl text-center text-[#777] mb-12 leading-relaxed font-medium">
           Move this profile—including its personalized recommendations, viewing history, My List, and more—to its own membership.
        </p>

        {/* Selected Profile Comparison Card */}
        <div className="w-full bg-[#f8f8f8] p-8 rounded-lg flex items-center justify-between mb-12 border border-[#eee] shadow-sm">
           <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 rounded shadow-md overflow-hidden border border-white/20">
                <Image 
                   src={selectedProfile?.avatar || '/assets/avatars/avatar1.png'} 
                   alt={selectedProfile?.name || 'Profile'} 
                   fill 
                   className="object-cover"
                />
              </div>
              <div className="space-y-0.5 text-left">
                <h2 className="text-2xl font-black text-black">{selectedProfile?.name || 'User'}</h2>
                <p className="text-[#14a331] font-bold text-sm">Ready to transfer</p>
              </div>
           </div>
           <ArrowRight className="w-8 h-8 text-[#ccc]" />
           <div className="w-20 h-20 rounded-md border-2 border-dashed border-[#ccc] flex items-center justify-center bg-white">
              <span className="text-[10px] text-[#999] font-black uppercase text-center px-1">New Account</span>
           </div>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-10 w-full mb-16">
           <div className="flex gap-6">
              <div className="w-10 h-10 rounded-full bg-[#0073e6]/10 flex items-center justify-center flex-shrink-0">
                 <ShieldCheck className="w-6 h-6 text-[#0073e6]" />
              </div>
              <div className="space-y-1.5 flex-1 text-left">
                 <h4 className="font-black text-black text-lg">Nothing changes here</h4>
                 <p className="text-[#777] leading-relaxed">We'll leave a copy of this profile on this account so you don't lose anything in the process.</p>
              </div>
           </div>
           <div className="flex gap-6">
              <div className="w-10 h-10 rounded-full bg-[#0073e6]/10 flex items-center justify-center flex-shrink-0">
                 <Info className="w-6 h-6 text-[#0073e6]" />
              </div>
              <div className="space-y-1.5 flex-1 text-left">
                 <h4 className="font-black text-black text-lg">What moves?</h4>
                 <p className="text-[#777] leading-relaxed font-medium">Recommendations, viewing history, My List, saved games, settings, and all your personal preferences.</p>
              </div>
           </div>
        </div>

        <div className="w-full space-y-6">
           <Button className="w-full bg-[#e50914] hover:bg-[#b20710] text-white py-8 text-xl font-black rounded-sm shadow-xl transition-transform active:scale-95 duration-200 uppercase tracking-wider">
              Start Profile Transfer
           </Button>
           <Link href="/account" className="block text-center text-[#0073e6] hover:underline font-black mt-4 text-lg">
              Not now
           </Link>
        </div>

        <footer className="mt-20 pt-10 border-t border-[#eee] w-full text-center">
           <p className="text-xs text-[#999] max-w-lg mx-auto">
              Profile Transfer is unavailable for certain types of accounts. Learn more about <span className="underline cursor-pointer hover:text-black">Profile Transfers</span>. By continuing, you agree to the Netflix <span className="underline">Terms of Use</span>.
           </p>
        </footer>
      </div>
    </main>
  );
}
