'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignupStore } from '@/hooks/use-signup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Lock } from 'lucide-react';

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function PaymentPickerPage() {
  const router = useRouter();
  const { email, password, plan } = useSignupStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fallbacks just in case page reloads and state drops
  const safeEmail = email || 'guest@example.com';
  const safePlan = plan || 'Standard';

  const handleStartMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (!email || !password) {
        throw new Error("Missing email or password. Please try signing up again.");
      }

      // Create exact Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Extract a default display name from email
      const defaultName = email.split('@')[0];
      await updateProfile(user, { displayName: defaultName });

      // Save plan and basic info to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        plan: safePlan,
        createdAt: new Date().toISOString(),
      });
      
      router.push('/profiles');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[440px] mx-auto mt-8 sm:mt-16 px-4">
      <div className="text-center mb-6 space-y-2">
        <Lock className="w-12 h-12 text-[#e50914] mx-auto mb-6" />
        <span className="text-[13px] font-medium uppercase tracking-tight">Step 3 of 3</span>
        <h1 className="text-[32px] font-bold leading-tight text-[#333]">Set up your payment</h1>
        <p className="text-[16px] text-[#333]">
          Your membership starts as soon as you set up payment.<br/>
          <strong>No commitments. Cancel online anytime.</strong>
        </p>
      </div>

      <div className="flex items-center justify-end gap-1 text-[13px] text-[#737373] mb-2 font-medium">
        Secure Server <Lock className="w-3 h-3 text-[#ffb53f]" fill="currentColor" />
      </div>

      <form onSubmit={handleStartMembership} className="space-y-4">
        {/* Fake CC UI */}
        <div className="border border-[#ccc] rounded-[4px] p-4 bg-white relative">
           <div className="flex items-center gap-2 mb-4">
               <CreditCard className="w-6 h-6 text-[#333]" />
               <span className="font-bold text-[#333]">Credit or Debit Card</span>
           </div>
           
           <div className="space-y-2">
             <Input 
                required 
                placeholder="Card number" 
                className="h-[50px] focus-visible:ring-black rounded-sm border-[#8c8c8c]"
                defaultValue="4111 1111 1111 1111"
             />
             <div className="flex gap-2">
                <Input 
                  required 
                  placeholder="Expiration date (MM/YY)" 
                  className="h-[50px] focus-visible:ring-black rounded-sm border-[#8c8c8c]"
                  defaultValue="12/28"
                />
                <Input 
                  required 
                  placeholder="CVV" 
                  className="h-[50px] focus-visible:ring-black rounded-sm border-[#8c8c8c]"
                  defaultValue="123"
                />
             </div>
             <Input 
                required 
                placeholder="Name on card" 
                className="h-[50px] focus-visible:ring-black rounded-sm border-[#8c8c8c]"
                defaultValue={safeEmail.split('@')[0].toUpperCase()}
             />
           </div>

           {error && (
             <div className="mt-4 p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200 font-medium">
               {error}
             </div>
           )}

           <div className="mt-4 p-4 bg-[#f4f4f4] rounded-sm text-sm text-[#333]">
              <div className="flex justify-between font-bold border-b border-[#ccc] pb-2 mb-2">
                 <span>{safePlan} Plan</span>
                 <span><a href="/signup/planform" className="text-blue-600 font-medium hover:underline">Change</a></span>
              </div>
              <p>You won't be charged (This is a dummy checkout).</p>
           </div>
        </div>

        <p className="text-[12px] text-[#737373] pt-4">
          By clicking the "Start Membership" button below, you agree to our Terms of Use and Privacy Statement. This is a clone and you are not actually making a purchase.
        </p>

        <Button 
          type="submit"
          disabled={loading}
          className="w-full h-[64px] bg-[#e50914] hover:bg-[#f6121d] disabled:bg-[#f6121d]/50 text-white text-2xl font-medium mt-6 rounded-[4px] flex items-center justify-center gap-3"
        >
          {loading ? (
             <>
               <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
               Processing...
             </>
          ) : (
             "Start Membership"
          )}
        </Button>
      </form>
    </div>
  );
}
