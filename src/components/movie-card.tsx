'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Play, Plus, Check, ChevronDown, ThumbsUp, Volume2 } from 'lucide-react';
import { Content, Episode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useWatchlist } from '@/hooks/use-store';
import { MovieDetailsDialog } from './movie-details-dialog';
import { HeroVideoPreview } from './hero-video-preview';
import { cn } from '@/lib/utils';

interface MovieCardProps {
  content: Content;
  aspectRatio?: 'portrait' | 'landscape';
  onPlay: (content: Content, episode?: Episode) => void;
}

export function MovieCard({ content, aspectRatio = 'landscape', onPlay }: MovieCardProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const [isHovered, setIsHovered] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const inList = isInWatchlist(content.id);

  // Close the hover portal when details open
  const showPortal = isHovered && !isDetailsOpen;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(content);
  };

  return (
    <div 
      className={cn(
        "relative transition-all duration-300 ease-out cursor-pointer rounded-sm group",
        aspectRatio === 'landscape' ? "w-[180px] sm:w-[240px] aspect-video" : "w-[120px] sm:w-[180px] aspect-[2/3]",
        showPortal ? "z-[101]" : "z-10"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Base Image */}
      <div className="relative w-full h-full overflow-hidden rounded-sm bg-[#333]">
        <Image
          src={aspectRatio === 'landscape' ? content.heroImage : content.thumbnail}
          alt={content.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 180px, 240px"
        />
        {/* Netflix N Logo Badge */}
        <div className="absolute top-1.5 left-1.5 z-20 w-4 h-6 sm:w-6 sm:h-9">
          <Image 
            src="/netflix-n-logo.svg" 
            alt="N" 
            fill 
            className="object-contain"
            unoptimized
          />
        </div>

        {/* Dynamic Badges (Recently Added, New Season, etc.) */}
        <div className="absolute bottom-2 left-0 z-20 flex flex-col gap-1 items-start">
          {content.isLeavingSoon && (
            <div className="bg-[#e50914] text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 uppercase tracking-tighter shadow-lg">
              Leaving Soon
            </div>
          )}
          {content.isNewSeason && !content.isLeavingSoon && (
            <div className="bg-[#e50914] text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 uppercase tracking-tighter shadow-lg">
              New Season
            </div>
          )}
          {content.isNewEpisode && !content.isNewSeason && !content.isLeavingSoon && (
            <div className="bg-[#e50914] text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 uppercase tracking-tighter shadow-lg">
              New Episode
            </div>
          )}
          {content.isRecentlyAdded && !content.isNewEpisode && !content.isNewSeason && !content.isLeavingSoon && (
            <div className="bg-[#e50914] text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 uppercase tracking-tighter shadow-lg">
              Recently Added
            </div>
          )}
        </div>
      </div>
      
      {/* Pop-out content on hover (The Mini-Player) */}
      <div className={cn(
        "absolute bg-[#181818] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 scale-90 pointer-events-none transition-all duration-300 ease-out flex flex-col overflow-hidden",
        "top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2",
        aspectRatio === 'landscape' 
          ? "w-[130%]" 
          : "w-[170%]", 
        showPortal && "opacity-100 scale-100 pointer-events-auto z-[101]"
      )}>
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-black">
           <Image
            src={content.heroImage}
            alt={content.title}
            fill
            className="object-cover"
          />
          {showPortal && (
            <HeroVideoPreview
              tmdbId={content.id}
              type={content.type === 'tv-show' ? 'tv' : 'movie'}
              delay={800} // Wait 0.8s on hover before resolving stream
              clipDuration={30}
              isMuted={true}
            />
          )}
          <div className="absolute bottom-2 left-4 z-10 pointer-events-none">
            <h3 className="text-white text-xs sm:text-base font-bold drop-shadow-md line-clamp-1">{content.title}</h3>
          </div>
        </div>

        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button 
              size="icon" 
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white text-black hover:bg-[#e6e6e6] p-0"
              onClick={handlePlayClick}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-[#808080] hover:border-white text-white p-0"
              onClick={(e) => {
                e.stopPropagation();
                inList ? removeFromWatchlist(content.id) : addToWatchlist(content);
              }}
            >
              {inList ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-[#808080] hover:border-white text-white p-0"
            >
              <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-[#808080] hover:border-white text-white ml-auto p-0"
              onClick={(e) => { e.stopPropagation(); setIsDetailsOpen(true); }}
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-1 sm:gap-2">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium">
              <span className="text-[#46d369]">98% Match</span>
              <span className="border border-white/40 px-1 rounded-sm text-white/80 text-[8px] sm:text-[10px]">16+</span>
              <span className="text-white/80">2h 15m</span>
              <span className="border border-white/40 px-1 rounded-sm text-white/80 text-[7px] sm:text-[8px] font-bold">HD</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[11px]">
              {content.genres.slice(0, 3).map((genre, idx) => (
                <span key={genre} className="text-white">
                  {genre}{idx < Math.min(content.genres.length, 3) - 1 ? ' • ' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MovieDetailsDialog 
        content={content} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
        onPlay={onPlay}
      />
    </div>
  );
}
