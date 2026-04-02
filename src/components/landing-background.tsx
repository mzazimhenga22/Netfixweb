'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getPopular } from '@/lib/tmdb';
import { Content } from '@/lib/types';

export function LandingBackground() {
  const [posters, setPosters] = useState<string[]>([]);

  useEffect(() => {
    async function loadPosters() {
      try {
        const movies = await getPopular('movie');
        // Duplicate posters to fill a large grid
        const urls = movies.map(m => m.thumbnail).filter(Boolean);
        setPosters([...urls, ...urls, ...urls, ...urls]); 
      } catch (error) {
        console.error('Failed to load posters:', error);
      }
    }
    loadPosters();
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      {/* Dark Overlay with Gradient */}
      <div className="absolute inset-0 bg-black/60 z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-[#141414]/50 z-20" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80 z-20" />

      {/* Poster Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1 opacity-40 scale-110 -rotate-3 -translate-y-20">
        {posters.map((url, i) => (
          <div key={i} className="aspect-[2/3] relative rounded-sm overflow-hidden shadow-2xl">
            <Image
              src={url}
              alt=""
              fill
              className="object-cover"
              sizes="200px"
              priority={i < 20}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
