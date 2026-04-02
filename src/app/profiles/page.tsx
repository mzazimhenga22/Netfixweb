'use client';

import { useAuth } from '@/hooks/use-store';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Plus, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ProfilesPage() {
  const { profiles, selectProfile, loading, user } = useAuth();
  const router = useRouter();
  
  // PIN Overlay State
  const [pinTarget, setPinTarget] = useState<any>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleProfileClick = (profile: any) => {
    if (profile.isLocked && profile.pin) {
      setPinTarget(profile);
      setPinValue('');
      setPinError(false);
    } else {
      selectProfile(profile);
      router.push('/browse');
    }
  };

  const handlePinInput = (num: string) => {
    if (pinValue.length >= 4) return;
    const newVal = pinValue + num;
    setPinValue(newVal);
    setPinError(false);

    if (newVal.length === 4) {
      if (newVal === pinTarget.pin) {
         selectProfile(pinTarget);
         router.push('/browse');
      } else {
         setTimeout(() => {
           setPinError(true);
           setPinValue('');
         }, 300);
      }
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center text-center relative overflow-hidden">
      
      {/* ─── Profile Selection View ─── */}
      <div className={cn(
        "space-y-8 transition-all duration-500",
        pinTarget ? "opacity-0 scale-95 pointer-events-none blur-sm" : "opacity-100 scale-100"
      )}>
        <h1 className="text-3xl md:text-5xl text-white font-medium tracking-tight">Who's watching?</h1>
        
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {profiles.map((profile) => (
            <div 
              key={profile.id} 
              className="group cursor-pointer flex flex-col gap-4 items-center"
              onClick={() => handleProfileClick(profile)}
            >
              <div className="relative w-24 h-24 md:w-36 md:h-36 rounded-md overflow-hidden border-[3px] border-transparent group-hover:border-white transition-all duration-300 transform group-hover:scale-105 bg-[#333]">
                <Image 
                  src={profile.avatar} 
                  alt={profile.name} 
                  fill 
                  className="object-cover"
                />
                {profile.isLocked && (
                  <div className="absolute bottom-1 right-1 bg-black/60 p-1 rounded-full">
                    <Lock className="w-3 h-3 text-white fill-current" />
                  </div>
                )}
              </div>
              <span className="text-[#808080] text-sm md:text-xl font-medium group-hover:text-white transition-colors">
                {profile.name}
              </span>
            </div>
          ))}
          
          {profiles.length < 5 && (
            <div 
               className="group cursor-pointer flex flex-col gap-4 items-center"
               onClick={() => router.push('/profiles/manage')}
            >
              <div className="w-24 h-24 md:w-36 md:h-36 rounded-md border-[3px] border-transparent bg-transparent flex items-center justify-center group-hover:bg-[#e5e5e5] transition-all duration-300 transform group-hover:scale-105">
                <Plus className="w-16 h-16 text-[#808080] group-hover:text-black" />
              </div>
              <span className="text-[#808080] text-sm md:text-xl font-medium group-hover:text-white transition-colors">
                Add Profile
              </span>
            </div>
          )}
        </div>

        <div className="pt-16">
          <Button 
            variant="outline" 
            className="border-[#808080] text-[#808080] rounded-none px-10 py-6 uppercase tracking-[0.2em] text-sm md:text-xl font-medium hover:border-white hover:text-white bg-transparent transition-all duration-300"
            onClick={() => router.push('/profiles/manage')}
          >
            Manage Profiles
          </Button>
        </div>
      </div>

      {/* ─── PIN Entry Overlay ─── */}
      {pinTarget && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
           <button 
             className="absolute top-8 left-8 text-white/60 hover:text-white transition-colors"
             onClick={() => setPinTarget(null)}
           >
             <X className="w-10 h-10" />
           </button>

           <div className="max-w-md w-full px-6 space-y-12">
              <div className="space-y-4">
                 <h2 className="text-xl text-white font-medium">Profile Lock is on.</h2>
                 <p className="text-3xl md:text-5xl text-white font-bold tracking-tight">Enter your PIN to access this profile.</p>
              </div>

              {/* PIN Slots */}
              <div className="flex justify-center gap-4">
                 {[0, 1, 2, 3].map((i) => (
                    <div 
                      key={i}
                      className={cn(
                        "w-12 h-12 md:w-20 md:h-20 border-2 flex items-center justify-center transition-all duration-200",
                        pinError ? "border-red-600 animate-shake" : "border-white",
                        pinValue[i] ? "bg-white" : "bg-transparent"
                      )}
                    >
                       {pinValue[i] && (
                         <div className="w-3 h-3 md:w-5 md:h-5 bg-black rounded-full" />
                       )}
                    </div>
                 ))}
              </div>

              {pinError && (
                 <p className="text-red-600 font-bold text-lg animate-in slide-in-from-top-2">Whoops, wrong PIN. Please try again.</p>
              )}

              {/* Pad */}
              <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-[280px] md:max-w-[400px] mx-auto pt-8">
                 {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                    <button
                      key={n}
                      className={cn(
                        "w-14 h-14 md:w-24 md:h-24 rounded-full border-2 border-white/20 text-white text-2xl md:text-4xl font-bold flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-90",
                        n === 0 && "col-start-2"
                      )}
                      onClick={() => handlePinInput(n.toString())}
                    >
                      {n}
                    </button>
                 ))}
              </div>

              <div className="pt-12">
                 <button 
                  className="text-[#808080] hover:text-white uppercase tracking-widest text-sm font-bold"
                  onClick={() => setPinTarget(null)}
                >
                    Forgot PIN?
                 </button>
              </div>
           </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
