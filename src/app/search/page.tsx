'use client';

import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { MovieCard } from '@/components/movie-card';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchContent, getTrending, getGenres } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { useAuth } from '@/hooks/use-store';
import { VideoPlayer } from '@/components/video-player';

export default function SearchPage() {
  const { isKidsMode } = useAuth();
  const [search, setSearch] = useState('');
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);

  // Video Player State
  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  // Initial load showing trending
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [trending, genreMap] = await Promise.all([
          getTrending('all', isKidsMode),
          getGenres()
        ]);
        setContent(trending);
        setGenres(Object.values(genreMap).slice(0, 15));
      } catch (error) {
        console.error('Init failed:', error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isKidsMode]);

  // Handle Search
  useEffect(() => {
    if (!search.trim()) {
      getTrending('all', isKidsMode).then(setContent);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchContent(search, isKidsMode);
        setContent(results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search, isKidsMode]);

  const filteredContent = useMemo(() => {
    if (!selectedGenre) return content;
    return content.filter(c => c.genres.includes(selectedGenre));
  }, [content, selectedGenre]);

  const handlePlay = (content: Content, episode?: Episode) => {
    setPlayingContent(content);
    setPlayingEpisode(episode);
  };

  return (
    <main className="min-h-screen bg-[#141414] pt-24 px-4 sm:px-12">
      <Navbar />

      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center mb-10">
        <h1 className="text-3xl font-headline font-bold text-white">Search Results</h1>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative group w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-white transition-colors" />
            <Input
              placeholder="Titles, people, genres..."
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 bg-black/60 border-white/20 focus:border-white focus:ring-0 text-white h-12"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar max-w-[400px]">
            <Button
              variant={selectedGenre === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGenre(null)}
              className={`rounded-none px-4 ${selectedGenre === null ? 'bg-white text-black' : 'border-white/20 text-white'}`}
            >
              All
            </Button>
            {genres.map(genre => (
              <Button
                key={genre}
                variant={selectedGenre === genre ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGenre(genre)}
                className={`rounded-none px-4 whitespace-nowrap ${selectedGenre === genre ? 'bg-white text-black' : 'border-white/20 text-white'}`}
              >
                {genre}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
          <div className="Netflix-spinner" />
          <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs">Searching...</p>
        </div>
      ) : filteredContent.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-10 pb-20">
          {filteredContent.map(item => (
            <div key={item.id}>
              <MovieCard content={item} onPlay={handlePlay} />
              <div className="mt-3">
                <p className="font-bold text-sm text-white line-clamp-1">{item.title}</p>
                <div className="flex items-center gap-2 text-xs text-[#808080] mt-1">
                  <span>{item.year}</span>
                  <span>•</span>
                  <span className="text-green-500 font-semibold">{item.rating}% Match</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center gap-4">
          <X className="w-16 h-16 text-[#808080] opacity-20" />
          <p className="text-xl text-[#808080]">No results found for "{search}"</p>
          <Button variant="link" className="text-white hover:underline" onClick={() => { setSearch(''); setSelectedGenre(null); }}>
            Clear all filters
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
