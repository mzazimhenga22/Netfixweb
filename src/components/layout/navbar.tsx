'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, LogOut, User, Settings, Users, HelpCircle, ArrowLeftRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAuth, useWatchlist, AVATAR_MAP } from '@/hooks/use-store';
import { cn } from '@/lib/utils';
import { getOnlyOnNetflix } from '@/lib/tmdb';
import { Content } from '@/lib/types';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { user, selectedProfile, logout, isKidsMode, toggleKidsMode } = useAuth();
  const [notifications, setNotifications] = useState<Content[]>([]);

  const fetchNotifications = async () => {
    try {
      const data = await getOnlyOnNetflix(isKidsMode);
      setNotifications(data.slice(0, 10)); // Show top 10 new arrivals
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Clear notifications when kids mode toggles to ensure fresh data next time it opens
    setNotifications([]);
  }, [isKidsMode]);

  const searchFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchToggle = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const navLinks = [
    { name: 'Home', href: '/browse' },
    { name: 'TV Shows', href: '/browse/tv' },
    { name: 'Movies', href: '/browse/movies' },
    { name: 'New & Popular', href: '/latest' },
    { name: 'My List', href: '/my-list' },
    { name: 'Browse by Languages', href: '/browse/languages' },
  ];

  return (
    <nav className={cn(
      "fixed top-0 w-full z-[100] transition-all duration-500 h-16 sm:h-20 flex items-center px-4 md:px-12",
      isScrolled ? "bg-[#141414] shadow-md" : "bg-gradient-to-b from-black/70 via-black/40 to-transparent"
    )}>
      <div className="flex items-center gap-4 md:gap-10 w-full max-w-[1920px] mx-auto">
        <Link href="/browse" className="relative flex items-center h-8 sm:h-10 transition-transform active:scale-95 duration-200">
          <Image
            src="/netflix-logo.png"
            alt="Netflix"
            width={120}
            height={32}
            className="h-full w-auto object-contain brightness-110"
            priority
          />
        </Link>

        {/* Primary Links */}
        <div className="hidden lg:flex items-center gap-5 text-[14px]">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href} 
              className={cn(
                "transition-colors duration-300 hover:text-[#b3b3b3]",
                pathname === link.href ? "text-white font-bold" : "text-white/90"
              )}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Secondary Links (Mobile / Tablet) */}
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-white text-sm font-bold flex items-center gap-1">
              Browse <span className="text-[10px]">▼</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black/95 border-white/10 text-white p-2 min-w-[150px]">
              {navLinks.map((link) => (
                <DropdownMenuItem key={link.name} asChild className="focus:bg-white/10 py-3 text-center">
                  <Link href={link.href}>{link.name}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1" />

        {/* Right Side Utilities */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Expanding Search Bar */}
          <form 
            ref={searchFormRef}
            onSubmit={handleSearchSubmit}
            className={cn(
                "flex items-center h-8 transition-all duration-300 px-2 rounded-sm border border-transparent",
                isSearchExpanded ? "bg-black border-white w-40 sm:w-64" : "w-8"
            )}
            onBlur={(e) => {
              // Only close if focus moves outside the entire form AND query is empty
              if (searchFormRef.current?.contains(e.relatedTarget as Node)) return;
              if (!searchQuery) setIsSearchExpanded(false);
            }}
          >
            <button 
              type="button"
              onClick={handleSearchToggle}
              className="text-white hover:opacity-80 transition-opacity"
            >
              <Search className="w-5 h-5 stroke-[2.5px]" />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Titles, people, genres"
              className={cn(
                "bg-transparent border-none text-white text-sm focus:ring-0 transition-all duration-300 h-full",
                isSearchExpanded ? "w-full ml-2 opacity-100" : "w-0 opacity-0 px-0"
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearchExpanded && searchQuery && (
                <X 
                  className="w-4 h-4 text-white hover:cursor-pointer" 
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }} 
                />
            )}
          </form>

          {/* Kids Toggle */}
          <button 
            className={cn(
              "hidden sm:block text-sm transition-colors cursor-pointer",
              isKidsMode ? "text-primary font-bold" : "text-white hover:text-[#b3b3b3]",
              selectedProfile?.isKids && "cursor-default opacity-80"
            )}
            onClick={() => {
              if (selectedProfile?.isKids) return;
              toggleKidsMode();
            }}
          >
            Kids
          </button>

          {/* Notifications */}
          <DropdownMenu onOpenChange={(open) => {
             if (open && notifications.length === 0) fetchNotifications();
          }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-transparent p-0 w-auto h-auto relative group">
                <Bell className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-primary rounded-full border border-black" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/95 border-white/10 text-white min-w-[320px] p-0 shadow-2xl mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="absolute top-[-8px] right-[10px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white/10" />
               
               <div className="max-h-[400px] overflow-y-auto hide-scrollbar">
                  {notifications.length > 0 ? (
                    <div className="flex flex-col">
                      {notifications.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5",
                            idx === notifications.length - 1 && "border-none"
                          )}
                          onClick={() => router.push(`/browse?watch=${item.id}`)}
                        >
                           <div className="relative w-24 aspect-video rounded-sm overflow-hidden flex-shrink-0">
                              <Image src={item.heroImage} alt={item.title} fill className="object-cover" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Recently Added</p>
                              <p className="text-sm font-bold text-white line-clamp-1">{item.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{item.genres.join(', ')}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
                       <Bell className="w-10 h-10" />
                       <p className="text-sm">No new notifications</p>
                    </div>
                  )}
               </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-sm overflow-hidden h-8 w-8 p-0 flex items-center justify-center hover:bg-transparent group">
                <Image
                  src={AVATAR_MAP[selectedProfile?.avatar || ''] || selectedProfile?.avatar || '/assets/avatars/avatar1.png'}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="object-cover rounded-sm transition-transform group-hover:scale-105"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/95 border-white/10 text-white min-w-[220px] p-2 shadow-2xl mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-4 flex items-center gap-3">
                <Image
                  src={AVATAR_MAP[selectedProfile?.avatar || ''] || selectedProfile?.avatar || '/assets/avatars/avatar1.png'}
                  alt="Profile"
                  width={32}
                  height={32}
                  className="rounded-sm shadow-md"
                />
                <span className="font-bold text-sm tracking-tight">{selectedProfile?.name || user?.name || 'User'}</span>
              </div>

              <DropdownMenuSeparator className="bg-white/10 mx-[-8px]" />

              <DropdownMenuItem asChild className="focus:bg-white/10 cursor-pointer py-2.5 px-3 flex items-center gap-3 group">
                <Link href="/profiles/manage">
                  <Users className="w-4 h-4 text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">Manage Profiles</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="focus:bg-white/10 cursor-pointer py-2.5 px-3 flex items-center gap-3 group">
                <Link href="/profiles/transfer">
                  <ArrowLeftRight className="w-4 h-4 text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">Transfer Profile</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="focus:bg-white/10 cursor-pointer py-2.5 px-3 flex items-center gap-3 group">
                <Link href="/account">
                  <User className="w-4 h-4 text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">Account</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="focus:bg-white/10 cursor-pointer py-2.5 px-3 flex items-center gap-3 group">
                <Link href="/account">
                  <HelpCircle className="w-4 h-4 text-white/60 group-hover:text-white" />
                  <span className="text-sm font-medium">Help Center</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-white/10 mx-[-8px]" />

              {user ? (
                <DropdownMenuItem 
                  onClick={() => {
                    logout();
                    router.push('/auth');
                  }} 
                  className="focus:bg-white/10 cursor-pointer py-3 px-3 text-center flex justify-center mt-1"
                >
                   <p className="text-sm hover:underline font-medium">Sign out of Netflix</p>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild className="focus:bg-white/10 cursor-pointer py-2">
                  <Link href="/auth" className="w-full text-center font-medium">Sign In</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
