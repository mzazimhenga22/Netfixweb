'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MovieCard } from './movie-card';
import { Content, Episode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MovieRowProps {
  title: string;
  items: Content[];
  aspectRatio?: 'portrait' | 'landscape';
  showNumbers?: boolean;
  onPlay: (content: Content, episode?: Episode) => void;
}

export function MovieRow({ title, items, aspectRatio = 'landscape', showNumbers = false, onPlay }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.9 
        : scrollLeft + clientWidth * 0.9;
      
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [items]);

  return (
    <div className="space-y-1 sm:space-y-2 py-2 relative group/row hover:z-[100] overflow-visible">
      <h2 className="text-lg sm:text-[1.4vw] font-bold px-4 md:px-12 text-[#e5e5e5] hover:text-white transition-colors cursor-pointer inline-block">
        {title} <ChevronRight className="inline-block w-4 h-4 opacity-0 group-hover/row:opacity-100 transition-opacity ml-1" />
      </h2>
      
      <div className="relative group/controls overflow-visible">
        {showLeftArrow && (
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-[110] w-12 flex items-center justify-center transition-opacity opacity-0 group-hover/row:opacity-100 bg-transparent"
          >
            <ChevronLeft className="w-8 h-8 md:w-12 md:h-12 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </button>
        )}

        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="row-scroll-container hide-scrollbar"
        >
          {items.map((item, index) => (
            <div key={item.id} className="flex-shrink-0 flex items-end">
              {showNumbers && (
                <div className="relative -mr-6 sm:-mr-12 z-20 select-none flex items-end h-full mb-[-10px] sm:mb-[-20px]">
                  <span className="text-[120px] sm:text-[220px] font-black leading-none outline-text tracking-tighter opacity-100 block transform scale-y-125 origin-bottom">
                    {index + 1}
                  </span>
                </div>
              )}
              <MovieCard content={item} aspectRatio={aspectRatio} onPlay={onPlay} />
            </div>
          ))}
        </div>

        {showRightArrow && (
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-[110] w-12 flex items-center justify-center transition-opacity opacity-0 group-hover/row:opacity-100 bg-transparent"
          >
            <ChevronRight className="w-8 h-8 md:w-12 md:h-12 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </button>
        )}
      </div>
    </div>
  );
}
