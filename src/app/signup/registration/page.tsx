'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignupStore } from '@/hooks/use-signup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RegistrationPage() {
  const router = useRouter();
  const { email, setPassword } = useSignupStore();
  const [passwordInput, setPasswordInput] = useState('');
  
  // If user lands here with no email in store, they bypassed the landing page.
  // In a real app we'd redirect to `/` or let them enter email here. 
  // For now, we assume email is there.
  
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.length >= 4) {
      setPassword(passwordInput);
      router.push('/signup/planform');
    }
  };

  return (
    <div className="max-w-[440px] mx-auto mt-8 sm:mt-16 px-4">
      <div className="mb-6 space-y-1">
        <span className="text-[13px] font-medium uppercase tracking-tight">Step 1 of 3</span>
        <h1 className="text-[32px] font-bold leading-tight text-[#333]">Create a password to start your membership</h1>
        <p className="text-[18px] text-[#333] pt-2">Just a few more steps and you're done! We hate paperwork, too.</p>
      </div>

      <form onSubmit={handleNext} className="space-y-4">
        <Input 
          type="email" 
          value={email}
          readOnly
          className="h-[60px] bg-white border-[#8c8c8c] text-black text-base px-4 focus-visible:ring-black"
          placeholder="Email"
        />
        <Input 
          type="password" 
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          required
          minLength={4}
          className="h-[60px] bg-white border-[#8c8c8c] text-black text-base px-4 focus-visible:ring-black"
          placeholder="Add a password"
        />

        <Button 
          type="submit"
          className="w-full h-[64px] bg-[#e50914] hover:bg-[#f6121d] text-white text-2xl font-medium mt-6 rounded-[4px]"
        >
          Next
        </Button>
      </form>
    </div>
  );
}
