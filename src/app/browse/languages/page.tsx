'use client';

import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { MovieCard } from '@/components/movie-card';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { discoverByLanguage, getLanguages } from '@/lib/tmdb';
import { Content, Episode } from '@/lib/types';
import { useAuth } from '@/hooks/use-store';
import { VideoPlayer } from '@/components/video-player';

const SORT_OPTIONS = [
  { id: 'popularity.desc', label: 'Suggestions for you' },
  { id: 'primary_release_date.desc', label: 'Year Released' },
  { id: 'original_title.asc', label: 'Alphabetical' },
];

export default function LanguagesPage() {
  const { isKidsMode } = useAuth();
  const [languages, setLanguages] = useState<{code: string, name: string}[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  // Video Player State
  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>();

  useEffect(() => {
    async function init() {
      const langs = await getLanguages();
      setLanguages(langs);
    }
    init();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const results = await discoverByLanguage(selectedLanguage, sortBy, isKidsMode);
        setContent(results);
      } catch (error) {
        console.error('Fetch failed:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedLanguage, sortBy, isKidsMode]);

  const handlePlay = (content: Content, episode?: Episode) => {
    setPlayingContent(content);
    setPlayingEpisode(episode);
  };

  const currentLangName = languages.find(l => l.code === selectedLanguage)?.name || 'English';
  const currentSortLabel = SORT_OPTIONS.find(s => s.id === sortBy)?.label || 'Suggestions for you';

  return (
    <main className="min-h-screen bg-[#141414] pt-24 pb-20">
      <Navbar />

      <div className="px-4 md:px-12 mt-10">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-10">
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mr-6">
            Browse by Languages
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-white/60 font-medium">Select Your Preferences</span>
            
            {/* Preference Type Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-black/60 border-white/20 text-white rounded-none flex items-center gap-3 px-4 py-2 hover:bg-black/80">
                  Original Language <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#141414] border-white/10 text-white rounded-none min-w-[200px]">
                <DropdownMenuItem className="focus:bg-white/10 flex items-center justify-between">
                  Original Language <Check className="w-4 h-4 text-white" />
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-white/10 opacity-40 cursor-not-allowed">Dubbing</DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-white/10 opacity-40 cursor-not-allowed">Subtitles</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-black/60 border-white/20 text-white rounded-none flex items-center gap-3 px-4 py-2 hover:bg-black/80 font-bold">
                  {currentLangName} <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#141414] border-white/10 text-white rounded-none min-w-[150px] max-h-[300px] overflow-y-auto">
                {languages.map(lang => (
                  <DropdownMenuItem 
                    key={lang.code} 
                    onClick={() => setSelectedLanguage(lang.code)}
                    className="focus:bg-white/10 flex items-center justify-between"
                  >
                    {lang.name} {selectedLanguage === lang.code && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-sm text-white/60 font-medium ml-2">Sort by</span>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-black/60 border-white/20 text-white rounded-none flex items-center gap-3 px-4 py-2 hover:bg-black/80 font-bold">
                  {currentSortLabel} <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#141414] border-white/10 text-white rounded-none min-w-[200px]">
                {SORT_OPTIONS.map(opt => (
                  <DropdownMenuItem 
                    key={opt.id} 
                    onClick={() => setSortBy(opt.id)}
                    className="focus:bg-white/10 flex items-center justify-between"
                  >
                    {opt.label} {sortBy === opt.id && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="Netflix-spinner" />
            <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase text-xs text-center">
              Fetching global hits
            </p>
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-10">
            {content.map(item => (
              <div key={item.id} className="group cursor-pointer">
                <MovieCard content={item} onPlay={handlePlay} />
                <div className="mt-3">
                  <p className="font-bold text-sm text-white line-clamp-1 group-hover:text-red-600 transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[#808080] mt-1">
                    <span className="border border-[#808080] px-1 text-[8px] rounded-sm">HD</span>
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
            <p className="text-xl text-[#808080]">No titles available in {currentLangName} right now.</p>
            <Button variant="link" className="text-white hover:underline" onClick={() => setSelectedLanguage('en')}>
              Back to English
            </Button>
          </div>
        )}
      </div>

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
