'use client';

import Image from 'next/image';
import { Play, Info, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Content } from '@/lib/types';
import { useState } from 'react';
import { MovieDetailsDialog } from './movie-details-dialog';
import { HeroVideoPreview } from './hero-video-preview';

interface HeroProps {
  content: Content;
  onPlay: () => void;
}

export function Hero({ content, onPlay }: HeroProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [clipReady, setClipReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <div className="relative w-full h-[56.25vw] max-h-[100vh] min-h-[500px] sm:min-h-[700px] overflow-hidden">
      {/* Static Hero Image — always present as base layer */}
      <Image
        src={content.heroImage}
        alt={content.title}
        fill
        className={`object-cover transition-opacity duration-[2000ms] ${
          clipReady ? 'opacity-0' : 'opacity-100'
        }`}
        priority
        style={{ zIndex: 1 }}
        data-ai-hint="cinematic background"
      />

      {/* Netflix-style Video Clip Preview — fades in over the image */}
      <HeroVideoPreview
        tmdbId={content.id}
        type={content.type === 'tv-show' ? 'tv' : 'movie'}
        delay={4000}
        clipDuration={90}
        isMuted={isMuted}
        onReady={() => setClipReady(true)}
      />
      
      {/* Cinematic Overlays — on top of both image and video */}
      <div className="absolute inset-0 hero-overlay z-[5]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent z-[6] opacity-100 h-full" />
      <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-[#141414] to-transparent z-[7]" />
      
      {/* Content Info */}
      <div className="absolute top-[35%] left-[4%] md:left-12 max-w-xl sm:max-w-2xl space-y-4 md:space-y-6 z-10">
        <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-md tracking-tight">
          {content.title}
        </h1>
        
        <p className="text-sm md:text-xl font-medium text-white/90 line-clamp-3 drop-shadow-md max-w-xl leading-snug">
          {content.description}
        </p>
        
        <div className="flex items-center gap-3 pt-4">
          <Button 
            size="lg" 
            className="bg-white text-black hover:bg-white/90 gap-2 font-bold px-6 sm:px-8 h-10 sm:h-12 text-sm sm:text-xl rounded-[4px]"
            onClick={onPlay}
          >
            <Play className="w-5 h-5 sm:w-8 sm:h-8 fill-current" /> Play
          </Button>
          <Button 
            variant="secondary" 
            size="lg" 
            className="bg-[#6d6d6eb3] hover:bg-[#6d6d6e66] text-white gap-2 font-bold px-6 sm:px-8 h-10 sm:h-12 text-sm sm:text-xl border-none rounded-[4px]"
            onClick={() => setIsDetailsOpen(true)}
          >
            <Info className="w-5 h-5 sm:w-8 sm:h-8" /> More Info
          </Button>
        </div>
      </div>

      {/* Right side utilities: Mute Button & Maturity Rating */}
      <div className="absolute right-0 bottom-[15%] md:bottom-[25%] flex items-center gap-4 z-10">
        {/* Mute/Unmute button — only shown when clip is enabled and ready to play */}
        {clipReady && (
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="rounded-full border border-white/50 bg-black/20 hover:bg-white/10 h-10 w-10 flex items-center justify-center text-white transition-all active:scale-90"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        )}

        {/* Maturity Rating Bar */}
        <div className="bg-black/40 border-l-[3px] border-white/60 text-white px-4 py-1.5 min-w-[100px] text-lg font-medium backdrop-blur-sm">
          {content.maturityRating || 'TV-MA'}
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
