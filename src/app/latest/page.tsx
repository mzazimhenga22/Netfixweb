'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Hero } from '@/components/hero';
import { MovieRow } from '@/components/movie-row';
import { getTrending, getPopular } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';

export default function LatestPage() {
  const [trending, setTrending] = useState<Content[]>([]);
  const [popularMovies, setPopularMovies] = useState<Content[]>([]);
  const [popularShows, setPopularShows] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  useEffect(() => {
    async function loadData() {
      try {
        const [trendingData, popularMoviesData, popularShowsData] = await Promise.all([
          getTrending('all'),
          getPopular('movie'),
          getPopular('tv-show')
        ]);

        // "New" is often simulated with current trending/popular
        setTrending(trendingData);
        setPopularMovies(popularMoviesData);
        setPopularShows(popularShowsData);

      } catch (error) {
        console.error('Failed to fetch Latest page data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handlePlay = (content: Content, episode?: Episode) => {
    setPlayingContent(content);
    setPlayingEpisode(episode);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-6">
        <div className="Netflix-spinner" />
        <p className="text-muted-foreground animate-pulse font-bold tracking-[0.2em] uppercase text-xs text-white">Loading New & Popular</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] pb-20 overflow-x-hidden">
      <Navbar />

      <div className="pt-24 px-4 md:px-12 mb-6 text-white font-bold text-4xl">
        <h1>New & Popular</h1>
      </div>

      <div className="relative z-40 space-y-12 pb-10">
        <MovieRow 
          title="New on Netflix" 
          items={trending} 
          onPlay={handlePlay} 
        />
        
        <MovieRow
          title="Worth the Wait"
          items={popularMovies.slice(10, 30)}
          onPlay={handlePlay}
        />

        <MovieRow
          title="Coming Next Week"
          items={popularShows.slice(10, 30)}
          onPlay={handlePlay}
        />

        <MovieRow
          title="Top 10 Movies Today"
          items={popularMovies.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />

        <MovieRow
          title="Top 10 TV Shows Today"
          items={popularShows.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />
      </div>

      {playingContent && (
        <VideoPlayer
          content={playingContent}
          episode={playingEpisode}
          onClose={() => setPlayingContent(null)}
        />
      )}
    </main>
  );
}
