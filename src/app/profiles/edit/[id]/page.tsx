'use client';

import { useAuth, useGlobalStore } from '@/hooks/use-store';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, Pencil, Trash2, Check, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const AVATARS = [
  'avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 
  'avatar6', 'avatar7', 'avatar8', 'avatar9', 'avatar10'
];

const AVATAR_MAP: Record<string, string> = {
  avatar1: '/assets/avatars/avatar1.png',
  avatar2: '/assets/avatars/avatar2.png',
  avatar3: '/assets/avatars/avatar3.png',
  avatar4: '/assets/avatars/avatar4.png',
  avatar5: '/assets/avatars/avatar5.png',
  avatar6: '/assets/avatars/avatar6.png',
  avatar7: '/assets/avatars/avatar7.png',
  avatar8: '/assets/avatars/avatar8.png',
  avatar9: '/assets/avatars/avatar9.png',
  avatar10: '/assets/avatars/avatar10.png',
};

export default function EditProfilePage() {
  const { profiles, loading } = useAuth();
  const { addProfile, updateProfile, deleteProfile } = useGlobalStore();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState('avatar1');
  const [isKids, setIsKids] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && profiles.length > 0) {
      const p = profiles.find(p => p.id === id);
      if (p) {
        setName(p.name);
        setAvatarId(p.avatarId || 'avatar1');
        setIsKids(p.isKids || false);
        setIsLocked(p.isLocked || false);
        setPin(p.pin || '');
      }
    }
  }, [id, isNew, profiles]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await addProfile(name, avatarId, isKids);
      } else {
        await updateProfile(id, {
          name,
          avatarId,
          isKids,
          isLocked,
          pin: isLocked ? pin : ''
        });
      }
      router.push('/profiles/manage');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this profile? History and My List will be lost.')) {
      await deleteProfile(id);
      router.push('/profiles/manage');
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center py-10 md:py-20 px-4">
      <div className="max-w-3xl w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <h1 className="text-4xl md:text-6xl font-medium tracking-tight text-center md:text-left border-b border-white/10 pb-6">
          {isNew ? 'Add Profile' : 'Edit Profile'}
        </h1>

        <div className="flex flex-col md:flex-row gap-10">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarPicker(true)}>
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-md overflow-hidden relative border-2 border-transparent group-hover:border-white transition-all">
                <Image src={AVATAR_MAP[avatarId]} alt="Avatar" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Pencil className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="flex-1 space-y-8">
             <div className="space-y-2">
                <Input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  className="bg-[#666] border-none text-white h-12 text-lg rounded-none focus-visible:ring-2 focus-visible:ring-white"
                />
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <div 
                    className={cn(
                        "w-7 h-7 border-2 flex items-center justify-center cursor-pointer transition-colors",
                        isKids ? "bg-white border-white" : "border-[#808080] bg-transparent"
                    )}
                    onClick={() => setIsKids(!isKids)}
                   >
                     {isKids && <Check className="w-5 h-5 text-black" />}
                   </div>
                   <div className="space-y-1">
                      <p className="text-lg font-medium leading-none">Kid?</p>
                      <p className="text-sm text-[#808080]">If selected, this profile will only see TV shows and movies rated for children.</p>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                   <div 
                    className={cn(
                        "w-7 h-7 border-2 flex items-center justify-center cursor-pointer transition-colors",
                        isLocked ? "bg-white border-white" : "border-[#808080] bg-transparent"
                    )}
                    onClick={() => setIsLocked(!isLocked)}
                   >
                     {isLocked && <Check className="w-5 h-5 text-black" />}
                   </div>
                   <div className="space-y-1">
                      <p className="text-lg font-medium leading-none flex items-center gap-2">
                        Profile Lock {isLocked && <Lock className="w-4 h-4 text-[#e50914] fill-current" />}
                      </p>
                      <p className="text-sm text-[#808080]">Secure this profile with a 4-digit PIN.</p>
                   </div>
                </div>

                {isLocked && (
                   <div className="pl-11 animate-in slide-in-from-left-4 duration-300">
                      <div className="flex flex-col gap-2 max-w-[200px]">
                        <span className="text-xs font-bold text-[#808080] uppercase tracking-wider">4-Digit PIN</span>
                        <Input 
                          type="password"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="0000"
                          className="bg-black border-2 border-white/20 h-12 text-2xl tracking-[1em] text-center rounded-none focus-visible:ring-primary"
                        />
                      </div>
                   </div>
                )}
             </div>

             <div className="pt-10 flex flex-wrap gap-4">
                <Button 
                   className="bg-white text-black hover:bg-white/90 rounded-none px-10 h-12 text-lg font-black uppercase tracking-wider"
                   onClick={handleSave}
                   disabled={saving}
                >
                   {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                   variant="outline"
                   className="border-[#808080] text-[#808080] rounded-none px-10 h-12 text-lg font-medium uppercase tracking-wider hover:bg-white/10"
                   onClick={() => router.push('/profiles/manage')}
                >
                   Cancel
                </Button>
                {!isNew && (
                  <Button 
                    variant="ghost"
                    className="text-[#808080] hover:text-[#e50914] rounded-none px-10 h-12 text-lg font-medium uppercase tracking-wider ml-auto gap-2"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-5 h-5" /> Delete Profile
                  </Button>
                )}
             </div>
          </div>
        </div>

      </div>

      {/* Avatar Picker Overlay */}
      {showAvatarPicker && (
         <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <button className="absolute top-8 left-8 text-white/60 hover:text-white" onClick={() => setShowAvatarPicker(false)}>
               <ChevronLeft className="w-10 h-10" />
            </button>
            <div className="max-w-4xl w-full space-y-12">
               <div className="space-y-4">
                  <h2 className="text-2xl md:text-4xl font-bold">Choose an image</h2>
                  <p className="text-xl text-[#808080]">Pick a classic look or something new.</p>
               </div>
               <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 md:gap-6">
                  {AVATARS.map((aid) => (
                     <div 
                        key={aid} 
                        className={cn(
                          "relative aspect-square cursor-pointer rounded-md overflow-hidden border-4 transition-all duration-200 transform hover:scale-110",
                          avatarId === aid ? "border-white" : "border-transparent"
                        )}
                        onClick={() => { setAvatarId(aid); setShowAvatarPicker(false); }}
                     >
                        <Image src={AVATAR_MAP[aid]} alt={aid} fill className="object-cover" />
                        {avatarId === aid && (
                          <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                             <Check className="w-8 h-8 md:w-12 md:h-12" />
                          </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
