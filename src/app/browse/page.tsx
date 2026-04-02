'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Hero } from '@/components/hero';
import { MovieRow } from '@/components/movie-row';
import { useWatchlist } from '@/hooks/use-store';
import { getTrending, getPopular } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/video-player';

export default function BrowsePage() {
  const { watchlist } = useWatchlist();
  const [trending, setTrending] = useState<Content[]>([]);
  const [popularMovies, setPopularMovies] = useState<Content[]>([]);
  const [popularShows, setPopularShows] = useState<Content[]>([]);
  const [actionContent, setActionContent] = useState<Content[]>([]);
  const [scifiContent, setScifiContent] = useState<Content[]>([]);
  const [comedyContent, setComedyContent] = useState<Content[]>([]);
  const [documentaries, setDocumentaries] = useState<Content[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  // Video Player State
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

        setTrending(trendingData);
        setPopularMovies(popularMoviesData);
        setPopularShows(popularShowsData);

        // Mixed content for specific genre rows
        const combined = [...popularMoviesData, ...popularShowsData].sort(() => Math.random() - 0.5);

        setActionContent(combined.filter(c => c.genres.includes('Action') || c.genres.includes('Adventure')).slice(0, 20));
        setScifiContent(combined.filter(c => c.genres.includes('Science Fiction') || c.genres.includes('Fantasy')).slice(0, 20));
        setComedyContent(combined.filter(c => c.genres.includes('Comedy')).slice(0, 20));
        setDocumentaries(combined.filter(c => c.genres.includes('Documentary')).slice(0, 20));

      } catch (error) {
        console.error('Failed to fetch home page data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync watchlist items
  useEffect(() => {
    if (!loading && watchlist.length > 0) {
      const cached = [...trending, ...popularMovies, ...popularShows, ...actionContent, ...scifiContent, ...comedyContent, ...documentaries];
      const found = watchlist.map(id => cached.find(c => c.id === id)).filter(Boolean) as Content[];
      
      // Remove duplicates
      const uniqueItems = Array.from(new Set(found.map(i => i.id))).map(id => found.find(i => i.id === id)) as Content[];
      setWatchlistItems(uniqueItems);
    } else if (watchlist.length === 0) {
      setWatchlistItems([]);
    }
  }, [watchlist, trending, popularMovies, popularShows, loading]);

  const handlePlay = (content: Content, episode?: Episode) => {
    console.log(`[BrowsePage] 🎬 Playing Content:`, content.title, episode ? `(Episode: ${episode.name})` : '');
    setPlayingContent(content);
    setPlayingEpisode(episode);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-6">
        <div className="Netflix-spinner" />
        <p className="text-muted-foreground animate-pulse font-bold tracking-[0.2em] uppercase text-xs">Loading Content</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#141414] pb-20 overflow-x-hidden">
      <Navbar />

      {/* Featured Hero */}
      {trending.length > 0 && <Hero content={trending[0]} onPlay={() => handlePlay(trending[0])} />}

      {/* Rows with light negative margin for cinematic overlay without crowding */}
      <div className="-mt-4 sm:-mt-8 md:-mt-12 relative z-40 space-y-0 pb-10">
        {watchlistItems.length > 0 && (
          <MovieRow title="My List" items={watchlistItems} onPlay={handlePlay} />
        )}

        <MovieRow title="Trending Now" items={trending} onPlay={handlePlay} />

        <MovieRow
          title="Top 10 Movies in the US Today"
          items={popularMovies.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />

        <MovieRow title="Binge-Worthy TV Shows" items={popularShows} onPlay={handlePlay} />
        <MovieRow title="New & Popular" items={trending.slice(10, 30)} onPlay={handlePlay} />
        <MovieRow title="Action & Adventure" items={actionContent} onPlay={handlePlay} />
        <MovieRow title="Sci-Fi & Fantasy" items={scifiContent} onPlay={handlePlay} />

        <MovieRow
          title="Top 10 TV Shows Today"
          items={popularShows.slice(0, 10)}
          aspectRatio="portrait"
          showNumbers={true}
          onPlay={handlePlay}
        />

        <MovieRow title="Comedies" items={comedyContent} onPlay={handlePlay} />
        <MovieRow title="Documentaries" items={documentaries} onPlay={handlePlay} />
        <MovieRow title="US TV Shows" items={popularShows.slice(10, 25)} onPlay={handlePlay} />
      </div>

      {/* Video Player Overlay */}
      {playingContent && (
        <VideoPlayer
          content={playingContent}
          episode={playingEpisode}
          onClose={() => setPlayingContent(null)}
        />
      )}

      <footer className="mt-20 px-4 md:px-24 lg:px-64 py-12 border-t border-white/10 flex flex-col gap-10 text-muted-foreground text-xs md:text-sm">
        <div className="flex flex-wrap gap-4">
          <span className="hover:text-white cursor-pointer">Audio and Subtitles</span>
          <span className="hover:text-white cursor-pointer">Audio Description</span>
          <span className="hover:text-white cursor-pointer">Help Center</span>
          <span className="hover:text-white cursor-pointer">Gift Cards</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
          <ul className="space-y-3">
            <li className="hover:underline cursor-pointer">Media Center</li>
            <li className="hover:underline cursor-pointer">Investor Relations</li>
            <li className="hover:underline cursor-pointer">Jobs</li>
          </ul>
          <ul className="space-y-3">
            <li className="hover:underline cursor-pointer">Terms of Use</li>
            <li className="hover:underline cursor-pointer">Privacy</li>
            <li className="hover:underline cursor-pointer">Legal Notices</li>
          </ul>
          <ul className="space-y-3">
            <li className="hover:underline cursor-pointer">Cookie Preferences</li>
            <li className="hover:underline cursor-pointer">Corporate Information</li>
            <li className="hover:underline cursor-pointer">Contact Us</li>
          </ul>
        </div>
        <div className="pt-4">
          <Button variant="outline" size="sm" className="border-white/20 text-muted-foreground hover:text-white rounded-none h-8 px-4">
            Service Code
          </Button>
          <p className="mt-6 text-[10px] md:text-xs">© 1997-2024 Netflix, Inc.</p>
        </div>
      </footer>
    </main>
  );
}