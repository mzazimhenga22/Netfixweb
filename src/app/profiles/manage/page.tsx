'use client';

import { useAuth } from '@/hooks/use-store';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ManageProfilesPage() {
  const { profiles } = useAuth();
  const router = useRouter();

  const MAX_PROFILES = 5;
  const canAddProfile = profiles.length < MAX_PROFILES;

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center text-center p-4">
      <div className="space-y-12 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl md:text-6xl text-white font-medium tracking-tight">Manage Profiles:</h1>
        
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {profiles.map((profile) => (
            <div 
              key={profile.id} 
              className="group cursor-pointer flex flex-col gap-4 items-center"
              onClick={() => router.push(`/profiles/edit/${profile.id}`)}
            >
              <div className="relative w-24 h-24 md:w-40 md:h-40 rounded-md overflow-hidden border-[3px] border-transparent group-hover:border-white transition-all duration-300">
                <Image 
                  src={profile.avatar} 
                  alt={profile.name} 
                  fill 
                  className="object-cover opacity-70 group-hover:opacity-40"
                />
                {/* Pencil Overlay - Matches Netflix authentic Manage Profiles UI */}
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-white flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <Pencil className="w-4 h-4 md:w-6 md:h-6 text-white" />
                   </div>
                </div>
              </div>
              <span className="text-[#808080] text-sm md:text-xl font-medium group-hover:text-white transition-colors">
                {profile.name}
              </span>
            </div>
          ))}
          
          {canAddProfile && (
            <div 
              className="group cursor-pointer flex flex-col gap-4 items-center"
              onClick={() => {
                 // In a real app, this would open a 'Create' screen. 
                 // For now, we'll create a default 'New Profile' and go to edit
                 router.push('/profiles/edit/new');
              }}
            >
              <div className="w-24 h-24 md:w-40 md:h-40 rounded-md border-[3px] border-transparent bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all duration-300 transform group-hover:scale-105">
                <Plus className="w-16 h-16 text-[#808080] group-hover:text-white" />
              </div>
              <span className="text-[#808080] text-sm md:text-xl font-medium group-hover:text-white transition-colors">
                Add Profile
              </span>
            </div>
          )}
        </div>

        <div className="pt-20">
          <Button 
            variant="ghost" 
            className="text-black bg-white hover:bg-white/90 rounded-none px-14 py-6 uppercase tracking-[0.2em] text-sm md:text-xl font-black transition-all duration-300 shadow-xl"
            onClick={() => router.push('/profiles')}
          >
            Done
          </Button>
        </div>

      </div>
    </div>
  );
}
