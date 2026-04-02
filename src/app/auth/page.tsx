'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { AuthFooter } from '@/components/auth-footer';
import { LandingBackground } from '@/components/landing-background';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push('/profiles');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Sorry, we can't find an account with this email address. Please try again or create a new account.");
      } else {
        setError("An unexpected error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-black selection:bg-primary selection:text-white">
      {/* Background with Dynamic Posters */}
      <div className="fixed inset-0 z-0">
        <LandingBackground />
      </div>

      {/* Header Logo */}
      <header className="relative z-10 w-full px-6 py-6 md:px-12 md:py-8 lg:px-44">
        <Image
          src="/netflix-logo.png"
          alt="Netflix"
          width={160}
          height={45}
          className="h-8 md:h-11 w-auto object-contain brightness-110"
        />
      </header>

      {/* Main Login Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start pt-12 pb-20 px-4 md:px-0">
        <div className="w-full max-w-[450px] bg-black/70 rounded-md p-10 md:p-16 flex flex-col shadow-2xl backdrop-blur-sm min-h-[660px] animate-in fade-in duration-500">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">Sign In</h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="bg-[#e87c03] rounded-[4px] py-3.5 px-5 text-white text-[14px] animate-in fade-in slide-in-from-top-2 duration-200">
                 {error}
              </div>
            )}

            {/* Email Input with Floating Label */}
            <div className="relative group">
              <input
                id="email"
                type="email"
                required
                className={cn(
                  "w-full bg-[#333]/80 border-none rounded-[4px] px-4 pt-6 pb-2 text-white h-14 outline-none focus:bg-[#454545] transition-all peer",
                  (email || isEmailFocused) ? "pt-6 pb-2" : "py-4"
                )}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
              />
              <label 
                htmlFor="email"
                className={cn(
                  "absolute left-4 transition-all duration-200 pointer-events-none text-[#8c8c8c]",
                  (email || isEmailFocused) 
                    ? "top-2 text-[11px] font-bold" 
                    : "top-1/2 -translate-y-1/2 text-[16px]"
                )}
              >
                Email or phone number
              </label>
            </div>

            {/* Password Input with Floating Label */}
            <div className="relative group">
              <input
                id="password"
                type="password"
                required
                className={cn(
                  "w-full bg-[#333]/80 border-none rounded-[4px] px-4 pt-6 pb-2 text-white h-14 outline-none focus:bg-[#454545] transition-all peer",
                  (password || isPasswordFocused) ? "pt-6 pb-2" : "py-4"
                )}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
              <label 
                htmlFor="password"
                className={cn(
                  "absolute left-4 transition-all duration-200 pointer-events-none text-[#8c8c8c]",
                  (password || isPasswordFocused) 
                    ? "top-2 text-[11px] font-bold" 
                    : "top-1/2 -translate-y-1/2 text-[16px]"
                )}
              >
                Password
              </label>
            </div>

            <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-[4px] mt-6 text-lg tracking-wide transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>

            <div className="flex flex-col items-center mt-2 gap-4">
               <span className="text-white hover:underline cursor-pointer text-base">OR</span>
               <Button variant="outline" className="w-full bg-white/10 border-none text-white hover:bg-white/20 h-12 rounded-[4px] font-bold">
                  Use a sign-in code
               </Button>
               <span className="text-white hover:underline cursor-pointer text-base">Forgot password?</span>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <input 
                type="checkbox" 
                id="remember" 
                defaultChecked 
                className="w-5 h-5 bg-[#333] border-none rounded-[2px] accent-primary cursor-pointer" 
              />
              <label htmlFor="remember" className="text-white text-base cursor-pointer">Remember me</label>
            </div>
          </form>

          <div className="mt-10 flex flex-col gap-4">
            <p className="text-[#737373] text-base">
              New to Netflix? <span className="text-white hover:underline cursor-pointer font-bold ml-1">Sign up now.</span>
            </p>
            <p className="text-[#8c8c8c] text-[13px] leading-tight">
              This page is protected by Google reCAPTCHA to ensure you're not a bot. <button className="text-[#0071eb] hover:underline cursor-pointer ml-1 inline">Learn more.</button>
            </p>
          </div>
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}
