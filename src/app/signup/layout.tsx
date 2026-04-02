import Link from 'next/link';
import Image from 'next/image';

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black font-body">
      <header className="border-b border-[#e6e6e6] bg-white h-[90px] flex items-center justify-between px-[3%] md:px-10">
        <Link href="/">
          <div className="relative w-32 h-10 cursor-pointer">
            <Image
              src="/netflix-logo.png"
              alt="Netflix Logo"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </Link>
        <Link href="/auth" className="text-[#333] hover:underline font-bold text-lg">
          Sign In
        </Link>
      </header>
      <main className="pb-32">
        {children}
      </main>
      
      <footer className="bg-[#f3f3f3] border-t border-[#e6e6e6] mt-auto py-8">
        <div className="max-w-[1000px] mx-auto px-[5%] text-[#737373]">
          <p className="mb-4 text-base">Questions? Contact us.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
            <span className="hover:underline cursor-pointer">FAQ</span>
            <span className="hover:underline cursor-pointer">Help Center</span>
            <span className="hover:underline cursor-pointer">Terms of Use</span>
            <span className="hover:underline cursor-pointer">Privacy</span>
            <span className="hover:underline cursor-pointer">Cookie Preferences</span>
            <span className="hover:underline cursor-pointer">Corporate Information</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
