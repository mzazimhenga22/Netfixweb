'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { MovieCard } from '@/components/movie-card';
import { useWatchlist } from '@/hooks/use-store';
import { getContentDetails } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';
import { BookmarkX, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function MyListPage() {
  const { watchlist } = useWatchlist();
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  // Video Player State
  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  useEffect(() => {
    async function fetchWatchlistDetails() {
      if (watchlist.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch details for each item in the watchlist
        // Note: In a real app we might want to batch this or use a cache
        const details = await Promise.all(
          watchlist.map(async (id) => {
            try {
              // We try to fetch as movie first, then tv if it fails or returns wrong type
              // This is a bit hacky but works for this demo
              return await getContentDetails(id, 'movie');
            } catch {
              try {
                return await getContentDetails(id, 'tv-show');
              } catch {
                return null;
              }
            }
          })
        );
        setItems(details.filter(Boolean) as Content[]);
      } catch (error) {
        console.error('Failed to fetch watchlist details:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWatchlistDetails();
  }, [watchlist]);

  const handlePlay = (content: Content, episode?: Episode) => {
    setPlayingContent(content);
    setPlayingEpisode(episode);
  };

  return (
    <main className="min-h-screen bg-[#141414] pt-24 px-4 sm:px-12 pb-20">
      <Navbar />
      
      <div className="mb-10 flex flex-col gap-2">
        <Link href="/browse" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 text-sm w-fit">
          <ChevronLeft className="w-4 h-4" />
          Back to Browse
        </Link>
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-white">My List</h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="Netflix-spinner" />
          <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">Loading your list...</p>
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-10">
          {items.map(content => (
            <div key={content.id} className="group">
              <MovieCard content={content} onPlay={handlePlay} />
              <div className="mt-3 opacity-100 group-hover:opacity-100 transition-opacity">
                <p className="font-bold text-sm text-white line-clamp-1">{content.title}</p>
                <p className="text-xs text-[#808080] mt-1">{content.year} • {content.duration}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center gap-6">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
            <BookmarkX className="w-10 h-10 text-white/20" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold text-white">Your list is empty.</p>
            <p className="text-white/40 max-w-xs mx-auto">Add movies and shows you want to watch later and they'll show up here.</p>
          </div>
          <Button asChild className="bg-white text-black hover:bg-white/90 rounded-none px-8 py-6 font-bold uppercase tracking-wider">
            <Link href="/browse">Browse Home</Link>
          </Button>
        </div>
      )}

      {/* Video Player Overlay */}
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
