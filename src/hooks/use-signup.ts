import { create } from 'zustand';

interface SignupState {
  email: string;
  password?: string;
  plan?: 'Basic' | 'Standard' | 'Premium';
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setPlan: (plan: 'Basic' | 'Standard' | 'Premium') => void;
  reset: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  email: '',
  setEmail: (email) => set({ email }),
  setPassword: (password) => set({ password }),
  setPlan: (plan) => set({ plan }),
  reset: () => set({ email: '', password: '', plan: undefined }),
}));
