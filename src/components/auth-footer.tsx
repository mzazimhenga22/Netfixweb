'use client';

import Link from 'next/link';

export function AuthFooter() {
  const footerLinks = [
    { title: 'Questions? Contact us.', url: '#' },
    { title: 'FAQ', url: '#' },
    { title: 'Help Center', url: '#' },
    { title: 'Terms of Use', url: '#' },
    { title: 'Privacy', url: '#' },
    { title: 'Cookie Preferences', url: '#' },
    { title: 'Corporate Information', url: '#' },
    { title: 'Ad Choices', url: '#' },
  ];

  return (
    <footer className="w-full bg-black/80 py-10 px-4 md:px-12 mt-auto z-10 border-t border-white/10 text-muted-foreground">
      <div className="max-w-[1000px] mx-auto space-y-8">
        <p className="hover:underline cursor-pointer">Questions? Contact us.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {footerLinks.slice(1).map((link) => (
            <Link key={link.title} href={link.url} className="hover:underline">
              {link.title}
            </Link>
          ))}
        </div>
        <div className="pt-4">
           <div className="inline-flex items-center border border-white/30 px-4 py-2 text-sm bg-black/40 text-muted-foreground cursor-pointer hover:bg-white/5 transition-colors">
              English <span className="ml-4 text-[10px]">▼</span>
           </div>
        </div>
      </div>
    </footer>
  );
}
