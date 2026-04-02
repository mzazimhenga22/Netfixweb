'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Hero } from '@/components/hero';
import { MovieRow } from '@/components/movie-row';
import { getTrending, getPopular } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';

export default function MoviesPage() {
  const [trending, setTrending] = useState<Content[]>([]);
  const [popularMovies, setPopularMovies] = useState<Content[]>([]);
  const [actionMovies, setActionMovies] = useState<Content[]>([]);
  const [scifiMovies, setScifiMovies] = useState<Content[]>([]);
  const [thrillerMovies, setThrillerMovies] = useState<Content[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<Content[]>([]);
  const [romanceMovies, setRomanceMovies] = useState<Content[]>([]);
  const [comedies, setComedies] = useState<Content[]>([]);
  const [documentaries, setDocumentaries] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  useEffect(() => {
    async function loadData() {
      try {
        const [trendingData, popularMoviesData] = await Promise.all([
          getTrending('movie'),
          getPopular('movie')
        ]);

        setTrending(trendingData);
        setPopularMovies(popularMoviesData);

        // Filtered rows
        setActionMovies(popularMoviesData.filter(c => c.genres.includes('Action') || c.genres.includes('Adventure')).slice(0, 20));
        setScifiMovies(popularMoviesData.filter(c => c.genres.includes('Science Fiction') || c.genres.includes('Fantasy')).slice(0, 20));
        setThrillerMovies(popularMoviesData.filter(c => c.genres.includes('Thriller') || c.genres.includes('Crime')).slice(0, 20));
        setHorrorMovies(popularMoviesData.filter(c => c.genres.includes('Horror')).slice(0, 20));
        setRomanceMovies(popularMoviesData.filter(c => c.genres.includes('Romance')).slice(0, 20));
        setComedies(popularMoviesData.filter(c => c.genres.includes('Comedy')).slice(0, 20));
        setDocumentaries(popularMoviesData.filter(c => c.genres.includes('Documentary')).slice(0, 20));

      } catch (error) {
        console.error('Failed to fetch Movies page data:', error);
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
        <p className="text-muted-foreground animate-pulse font-bold tracking-[0.2em] uppercase text-xs text-white">Loading Movies</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] pb-20 overflow-x-hidden">
      <Navbar />

      <div className="pt-24 px-4 md:px-12 mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-4xl font-bold text-white">Movies</h1>
          <div className="flex items-center border border-white px-4 py-1 text-sm text-white bg-black/40 cursor-pointer hover:bg-white/10 transition-colors">
            Genres <span className="ml-4 text-[10px]">▼</span>
          </div>
        </div>
      </div>

      {trending.length > 0 && <Hero content={trending[0]} onPlay={() => handlePlay(trending[0])} />}

      <div className="-mt-8 sm:-mt-12 md:-mt-20 relative z-40 space-y-0 pb-10">
        <MovieRow title="Trending Now" items={trending} onPlay={handlePlay} />
        
        <MovieRow
          title="Top 10 Movies Today"
          items={popularMovies.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />

        <MovieRow title="Popular on Netflix" items={popularMovies.slice(10, 30)} onPlay={handlePlay} />
        <MovieRow title="Action & Adventure" items={actionMovies} onPlay={handlePlay} />
        <MovieRow title="Thriller Movies" items={thrillerMovies} onPlay={handlePlay} />
        <MovieRow title="Sci-Fi & Fantasy" items={scifiMovies} onPlay={handlePlay} />
        <MovieRow title="Horror Movies" items={horrorMovies} onPlay={handlePlay} />
        <MovieRow title="Romance Movies" items={romanceMovies} onPlay={handlePlay} />
        <MovieRow title="Comedies" items={comedies} onPlay={handlePlay} />
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
