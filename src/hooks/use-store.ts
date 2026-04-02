'use client';

import { create } from 'zustand';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  avatarId: string;
  isLocked?: boolean;
  pin?: string;
  isKids?: boolean;
}

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

interface GlobalState {
  user: { name: string; email: string; uid: string } | null;
  loading: boolean;
  profiles: Profile[];
  selectedProfile: Profile | null;
  watchlist: any[];
  
  _unsubProfiles: (() => void) | null;
  _unsubWatchlist: (() => void) | null;

  isKidsMode: boolean;
  toggleKidsMode: () => void;

  initActiveListeners: (uid: string) => void;
  selectProfile: (profile: Profile) => void;
  signIn: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Profile CRUD
  addProfile: (name: string, avatarId: string, isKids?: boolean) => Promise<void>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  
  addToWatchlist: (item: any) => Promise<void>;
  removeFromWatchlist: (id: string | number) => Promise<void>;
  isInWatchlist: (id: string | number) => boolean;
}

export const useGlobalStore = create<GlobalState>((set, get) => ({
  user: null,
  loading: true,
  profiles: [],
  selectedProfile: null,
  watchlist: [],
  _unsubProfiles: null,
  _unsubWatchlist: null,

  isKidsMode: typeof window !== 'undefined' ? localStorage.getItem('Netflix_kids_mode') === 'true' : false,
  
  toggleKidsMode: () => {
    const newVal = !get().isKidsMode;
    set({ isKidsMode: newVal });
    localStorage.setItem('Netflix_kids_mode', newVal.toString());
  },

  signIn: async (email: string, pass: string) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, pass);
  },

  initActiveListeners: (uid: string) => {
    // 1. Listen to Profiles
    const { _unsubProfiles } = get();
    if (_unsubProfiles) _unsubProfiles();

    const profilesRef = collection(db, 'users', uid, 'profiles');
    const unsubP = onSnapshot(profilesRef, (snapshot) => {
      const fetched: Profile[] = [];
      snapshot.forEach(d => {
        const data = d.data();
        fetched.push({
          id: d.id,
          name: data.name,
          avatarId: data.avatarId || 'avatar1',
          avatar: AVATAR_MAP[data.avatarId as string] || AVATAR_MAP['avatar1'],
          isLocked: data.isLocked || false,
          pin: data.pin || '',
          isKids: data.isKids || false,
        });
      });
      
      // Auto-create a default profile if none exists (Fix for new signups)
      if (fetched.length === 0) {
        const defaultProfileRef = doc(collection(db, 'users', uid, 'profiles'));
        setDoc(defaultProfileRef, {
          name: 'My Profile',
          avatarId: 'avatar1',
          isKids: false,
          isLocked: false,
          createdAt: Date.now()
        });
        return; // Snapshot will trigger again automatically
      }
      
      set({ profiles: fetched });

      // Automatically select the saved profile or the first one securely
      const savedPid = localStorage.getItem('Netflix_profile_id');
      const currentSelected = get().selectedProfile;
      
      if (!currentSelected && fetched.length > 0) {
        const matched = fetched.find(p => p.id === savedPid);
        if (matched) {
          get().selectProfile(matched);
        }
      }
    });

    set({ _unsubProfiles: unsubP });
  },

  selectProfile: (profile: Profile) => {
    set({ selectedProfile: profile, isKidsMode: profile.isKids || false });
    localStorage.setItem('Netflix_profile_id', profile.id);
    localStorage.setItem('Netflix_kids_mode', (profile.isKids || false).toString());

    // 2. Listen to Watchlist (MyList) for the active profile
    const { user, _unsubWatchlist } = get();
    if (!user) return;
    
    if (_unsubWatchlist) _unsubWatchlist();

    const listRef = collection(db, 'users', user.uid, 'profiles', profile.id, 'myList');
    const unsubW = onSnapshot(listRef, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      set({ watchlist: items });
    });

    set({ _unsubWatchlist: unsubW });
  },

  addProfile: async (name: string, avatarId: string, isKids: boolean = false) => {
    const { user } = get();
    if (!user) return;
    const ref = doc(collection(db, 'users', user.uid, 'profiles'));
    await setDoc(ref, {
      name,
      avatarId,
      isKids,
      isLocked: false,
      pin: '',
      createdAt: Date.now()
    });
  },

  updateProfile: async (id: string, data: Partial<Profile>) => {
    const { user } = get();
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'profiles', id);
    await setDoc(ref, data, { merge: true });
  },

  deleteProfile: async (id: string) => {
    const { user } = get();
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'profiles', id);
    await deleteDoc(ref);
  },

  logout: async () => {
    const { _unsubProfiles, _unsubWatchlist } = get();
    if (_unsubProfiles) _unsubProfiles();
    if (_unsubWatchlist) _unsubWatchlist();
    
    await firebaseSignOut(auth);
    set({ user: null, profiles: [], selectedProfile: null, watchlist: [] });
    localStorage.removeItem('Netflix_profile_id');
  },

  addToWatchlist: async (item: any) => {
    const { user, selectedProfile } = get();
    if (!user || !selectedProfile || !item || !item.id) return;
    
    const docRef = doc(db, 'users', user.uid, 'profiles', selectedProfile.id, 'myList', item.id.toString());
    await setDoc(docRef, { ...item, addedAt: Date.now() });
  },

  removeFromWatchlist: async (id: string | number) => {
    const { user, selectedProfile } = get();
    if (!user || !selectedProfile) return;
    
    const docRef = doc(db, 'users', user.uid, 'profiles', selectedProfile.id, 'myList', id.toString());
    await deleteDoc(docRef);
  },

  isInWatchlist: (id: string | number) => {
    return get().watchlist.some(item => item.id.toString() === id.toString());
  }
}));

// Initialize Global Auth Listener once safely (outside React render loop)
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (firebaseUser) => {
    const store = useGlobalStore.getState();
    if (firebaseUser) {
      store.initActiveListeners(firebaseUser.uid);
      useGlobalStore.setState({
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        },
        loading: false
      });
    } else {
      store.logout();
      useGlobalStore.setState({ loading: false });
    }
  });
}

// ─── Legacy Wrapper Hooks (to prevent breaking current components) ───

export function useAuth() {
  const user = useGlobalStore(s => s.user);
  const loading = useGlobalStore(s => s.loading);
  const profiles = useGlobalStore(s => s.profiles);
  const selectedProfile = useGlobalStore(s => s.selectedProfile);
  const selectProfile = useGlobalStore(s => s.selectProfile);
  const logout = useGlobalStore(s => s.logout);
  const signIn = useGlobalStore(s => s.signIn);
  const isKidsMode = useGlobalStore(s => s.isKidsMode);
  const toggleKidsMode = useGlobalStore(s => s.toggleKidsMode);

  return { 
    user, loading, selectedProfile, profiles, logout, 
    signIn, selectProfile, isKidsMode, toggleKidsMode 
  };
}

export function useWatchlist() {
  const watchlist = useGlobalStore(s => s.watchlist);
  const addToWatchlist = useGlobalStore(s => s.addToWatchlist);
  const removeFromWatchlist = useGlobalStore(s => s.removeFromWatchlist);
  const isInWatchlist = useGlobalStore(s => s.isInWatchlist);

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist };
}
