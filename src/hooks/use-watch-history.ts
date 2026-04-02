'use client';

import { create } from 'zustand';
import { collection, doc, setDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGlobalStore } from './use-store';

export interface WatchHistoryItem {
  id: string | number;
  type: 'movie' | 'tv-show' | 'tv';
  currentTime: number;
  duration: number;
  lastUpdated: number;
  season?: number;
  episode?: number;
  item: any;
}

const THROTTLE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes identical to Native App
const lastSaveProgressTime: Record<string, number> = {};

export const WatchHistoryService = {
  _buildStorageId(itemId: string, type: string, season?: number, episode?: number): string {
    if ((type === 'tv-show' || type === 'tv') && season !== undefined && episode !== undefined) {
      return `${itemId}_s${season}_e${episode}`;
    }
    return itemId;
  },

  async saveProgress(
    item: any, 
    type: 'movie' | 'tv-show' | 'tv', 
    currentTime: number, 
    duration: number, 
    season?: number, 
    episode?: number,
    forceSave: boolean = false
  ) {
     const { user, selectedProfile } = useGlobalStore.getState();
     if (!user || !selectedProfile || !item || !item.id) return;

     const itemId = item.id.toString();
     const storageId = this._buildStorageId(itemId, type, season, episode);
     const now = Date.now();
     const lastSave = lastSaveProgressTime[storageId] || 0;

     // Throttle identical to Native app (or bypass if specifically triggered like pause/close)
     if (!forceSave && now - lastSave < THROTTLE_INTERVAL_MS) {
        return;
     }

     lastSaveProgressTime[storageId] = now;

     try {
       const historyDocRef = doc(db, 'users', user.uid, 'profiles', selectedProfile.id, 'watchHistory', storageId);
       
       await setDoc(historyDocRef, {
          id: itemId,
          type, 
          currentTime,
          duration,
          lastUpdated: serverTimestamp(),
          item,
          ...(season !== undefined && { season }),
          ...(episode !== undefined && { episode }),
       }, { merge: true });
     } catch (e) {
       console.error('[WatchHistory] Failed to save progress to Firestore', e);
     }
  }
};

interface WatchHistoryState {
  history: WatchHistoryItem[];
  _unsub: (() => void) | null;
  initListener: () => void;
}

export const useWatchHistoryStore = create<WatchHistoryState>((set, get) => ({
  history: [],
  _unsub: null,
  
  initListener: () => {
     const { user, selectedProfile } = useGlobalStore.getState();
     const { _unsub } = get();
     if (_unsub) _unsub();

     if (!user || !selectedProfile) return set({ history: [] });

     const historyRef = collection(db, 'users', user.uid, 'profiles', selectedProfile.id, 'watchHistory');
     const q = query(historyRef, orderBy('lastUpdated', 'desc'), limit(50));
     
     const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => {
          const data = d.data();
          return {
             ...data,
             id: d.id,
             // Map firestore timestamp back to numeric seamlessly
             lastUpdated: data.lastUpdated?.toMillis?.() || Date.now()
          } as WatchHistoryItem;
        });
        set({ history: items });
     });

     set({ _unsub: unsub });
  }
}));

// Auto-boot listener when the user's selected profile changes
// Only execute strictly in browser to prevent SSR crashes
if (typeof window !== 'undefined') {
  useGlobalStore.subscribe((state, prevState) => {
     if (state.selectedProfile?.id !== prevState.selectedProfile?.id) {
         useWatchHistoryStore.getState().initListener();
     }
  });
}

export function useWatchHistory() {
   const history = useWatchHistoryStore(s => s.history);
   const getProgress = (itemId: string | number, season?: number, episode?: number) => {
      const id = itemId.toString();
      
      if (season !== undefined && episode !== undefined) {
          const epMatch = history.find(h => h.id.toString() === id && h.season === season && h.episode === episode);
          if (epMatch) return epMatch;
      }

      // Resume from anywhere block...
      return history.find(h => h.id.toString() === id) || null;
   };

   return { 
      history, 
      saveProgress: WatchHistoryService.saveProgress.bind(WatchHistoryService),
      getProgress 
   };
}
