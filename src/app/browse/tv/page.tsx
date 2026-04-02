'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Hero } from '@/components/hero';
import { MovieRow } from '@/components/movie-row';
import { getTrending, getPopular, getGenres } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';

export default function TVShowsPage() {
  const [trending, setTrending] = useState<Content[]>([]);
  const [popularShows, setPopularShows] = useState<Content[]>([]);
  const [actionShows, setActionShows] = useState<Content[]>([]);
  const [animationShows, setAnimationShows] = useState<Content[]>([]);
  const [comedyShows, setComedyShows] = useState<Content[]>([]);
  const [scifiShows, setScifiShows] = useState<Content[]>([]);
  const [mysteryShows, setMysteryShows] = useState<Content[]>([]);
  const [realityShows, setRealityShows] = useState<Content[]>([]);
  const [documentaries, setDocumentaries] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  useEffect(() => {
    async function loadData() {
      try {
        const [trendingData, popularShowsData] = await Promise.all([
          getTrending('tv'),
          getPopular('tv-show')
        ]);

        setTrending(trendingData);
        setPopularShows(popularShowsData);

        // Filtered rows
        setActionShows(popularShowsData.filter(c => c.genres.includes('Action') || c.genres.includes('Adventure')).slice(0, 20));
        setAnimationShows(popularShowsData.filter(c => c.genres.includes('Animation')).slice(0, 20));
        setComedyShows(popularShowsData.filter(c => c.genres.includes('Comedy')).slice(0, 20));
        setScifiShows(popularShowsData.filter(c => c.genres.includes('Sci-Fi') || c.genres.includes('Science Fiction')).slice(0, 20));
        setMysteryShows(popularShowsData.filter(c => c.genres.includes('Mystery') || c.genres.includes('Crime')).slice(0, 20));
        setRealityShows(popularShowsData.filter(c => c.genres.includes('Reality')).slice(0, 20));
        setDocumentaries(popularShowsData.filter(c => c.genres.includes('Documentary')).slice(0, 20));

      } catch (error) {
        console.error('Failed to fetch TV page data:', error);
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
        <p className="text-muted-foreground animate-pulse font-bold tracking-[0.2em] uppercase text-xs text-white">Loading TV Shows</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] pb-20 overflow-x-hidden">
      <Navbar />

      <div className="pt-24 px-4 md:px-12 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-bold text-white">TV Shows</h1>
          <div className="flex items-center border border-white px-4 py-1 text-sm text-white bg-black/40 cursor-pointer hover:bg-white/10 transition-colors">
            Genres <span className="ml-4 text-[10px]">▼</span>
          </div>
        </div>
      </div>

      {trending.length > 0 && <Hero content={trending[0]} onPlay={() => handlePlay(trending[0])} />}

      <div className="-mt-8 sm:-mt-12 md:-mt-20 relative z-40 space-y-0 pb-10">
        <MovieRow title="Trending Now" items={trending} onPlay={handlePlay} />
        
        <MovieRow
          title="Top 10 TV Shows Today"
          items={popularShows.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />

        <MovieRow title="Binge-Worthy TV Shows" items={popularShows.slice(10, 30)} onPlay={handlePlay} />
        <MovieRow title="Action & Adventure TV" items={actionShows} onPlay={handlePlay} />
        <MovieRow title="Sci-Fi & Fantasy TV" items={scifiShows} onPlay={handlePlay} />
        <MovieRow title="Mystery & Crime" items={mysteryShows} onPlay={handlePlay} />
        <MovieRow title="Animation" items={animationShows} onPlay={handlePlay} />
        <MovieRow title="Reality TV" items={realityShows} onPlay={handlePlay} />
        <MovieRow title="Comedies" items={comedyShows} onPlay={handlePlay} />
        <MovieRow title="Documentaries" items={documentaries} onPlay={handlePlay} />
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
