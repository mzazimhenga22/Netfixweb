'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Plus, Check, Volume2, ThumbsUp } from 'lucide-react';
import { Content, Episode } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useWatchlist } from '@/hooks/use-store';
import { getContentDetails, getSimilar, getEpisodes } from '@/lib/tmdb';
import { HeroVideoPreview } from './hero-video-preview';

interface MovieDetailsDialogProps {
  content: Content;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay: (content: Content, episode?: Episode) => void;
}

export function MovieDetailsDialog({ content: initialContent, open, onOpenChange, onPlay }: MovieDetailsDialogProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const [content, setContent] = useState<Content>(initialContent);
  const [similar, setSimilar] = useState<Content[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('1');

  const inList = isInWatchlist(content.id);

  // Load full details when open
  useEffect(() => {
    async function loadFullDetails() {
      if (!open) return;
      setLoading(true);
      try {
        const [fullData, similarData] = await Promise.all([
          getContentDetails(initialContent.id, initialContent.type),
          getSimilar(initialContent.id, initialContent.type)
        ]);
        setContent(fullData);
        setSimilar(similarData);
        setSelectedSeason('1'); // Reset season to 1 for new content
      } catch (error) {
        console.error('Failed to load full content details:', error);
      } finally {
        setLoading(false);
      }
    }
    loadFullDetails();
  }, [open, initialContent]);

  // Load episodes when season changes or content changes
  useEffect(() => {
    async function loadEpisodes() {
      if (!open || content.type !== 'tv-show') return;
      setEpisodesLoading(true);
      try {
        const epData = await getEpisodes(content.id, selectedSeason);
        setEpisodes(epData);
      } catch (error) {
        console.error('Failed to load episodes:', error);
      } finally {
        setEpisodesLoading(false);
      }
    }
    loadEpisodes();
  }, [open, content.id, content.type, selectedSeason]);

  const handleEpisodePlay = (ep: Episode) => {
    onPlay(content, { ...ep, seasonNumber: parseInt(selectedSeason) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-[#181818] text-foreground netflix-shadow rounded-lg max-h-[95vh] flex flex-col scrollbar-hide">
        <DialogHeader className="sr-only">
          <DialogTitle>{content.title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="aspect-video flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
            <div className="Netflix-spinner" />
          </div>
        ) : (
          <div className="overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
            <div className="relative aspect-video overflow-hidden bg-black">
              <Image
                src={content.heroImage}
                alt={content.title}
                fill
                className="object-cover"
                priority
              />
              
              <HeroVideoPreview
                tmdbId={content.id}
                type={content.type === 'tv-show' ? 'tv' : 'movie'}
                delay={500}
                clipDuration={60}
                isMuted={true}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/10 to-transparent pointer-events-none" style={{ zIndex: 3 }} />

              <div className="absolute bottom-8 left-8 right-8 flex flex-col gap-4" style={{ zIndex: 10 }}>
                <h2 className="text-4xl md:text-5xl font-headline font-black uppercase tracking-tight max-w-lg drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] text-white">{content.title}</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="lg"
                    className="bg-white text-black hover:bg-white/90 gap-2 font-bold px-8 rounded-sm"
                    onClick={() => {
                      onPlay(content);
                      onOpenChange(false);
                    }}
                  >
                    <Play className="w-6 h-6 fill-current" /> Play
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full border-2 w-11 h-11 bg-[#2a2a2a]/60 hover:bg-white/20 border-white/50 text-white"
                    onClick={() => inList ? removeFromWatchlist(content.id) : addToWatchlist(content)}
                  >
                    {inList ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full border-2 w-11 h-11 bg-[#2a2a2a]/60 hover:bg-white/20 border-white/50 text-white"
                  >
                    <ThumbsUp className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <span className="text-[#46d369]">98% Match</span>
                    <span className="text-white">{content.year}</span>
                    <span className="border border-white/40 px-2 py-0.5 text-[10px] rounded-sm uppercase">HD</span>
                    <span className="text-white">{content.duration}</span>
                  </div>

                  <p className="text-lg leading-relaxed text-white">
                    {content.description}
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-[#777]">Genres:</span>{' '}
                    <span className="text-white hover:underline cursor-pointer">{content.genres.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-[#777]">Available in:</span>{' '}
                    <span className="text-white">English, Italian, Latin, Español</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Section */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {content.type === 'tv-show' && content.seasonsCount && (
                    <div className="w-48">
                      <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                        <SelectTrigger className="bg-[#242424] border-white/20 text-white h-10">
                          <SelectValue placeholder="Select Season" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#242424] border-white/20 text-white">
                          {Array.from({ length: content.seasonsCount }, (_, i) => i + 1).map((s) => (
                            <SelectItem key={s} value={String(s)}>Season {s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold text-white">
                    {content.type === 'movie' ? 'More Like This' : 'Episodes'}
                  </h3>
                </div>

                {content.type === 'movie' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {similar.map((item) => (
                      <div key={item.id} className="bg-[#2f2f2f] rounded-md overflow-hidden group cursor-pointer" onClick={() => onPlay(item)}>
                        <div className="relative aspect-video">
                          <Image src={item.heroImage} alt={item.title} fill className="object-cover" />
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="text-[#46d369] text-xs font-bold">95% Match</div>
                              <div className="flex items-center gap-2">
                                <span className="border border-white/40 px-1 text-[8px] rounded-sm">18+</span>
                                <span className="text-white text-xs">{item.year}</span>
                              </div>
                            </div>
                            <Button variant="outline" size="icon" className="rounded-full w-8 h-8 border-white/40 bg-transparent hover:bg-white/10 text-white">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-[#d2d2d2] line-clamp-3 leading-tight">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {episodesLoading ? (
                      <div className="flex justify-center py-20">
                        <div className="Netflix-spinner" />
                      </div>
                    ) : episodes.length > 0 ? (
                      episodes.map((ep) => (
                        <div
                          key={ep.id}
                          className="flex items-center gap-4 p-4 rounded-md hover:bg-[#333] transition-colors cursor-pointer border-b border-white/10"
                          onClick={() => handleEpisodePlay(ep)}
                        >
                          <span className="text-2xl text-[#777] font-bold w-6">{ep.episodeNumber}</span>
                          <div className="relative w-40 aspect-video rounded-md overflow-hidden bg-[#222] flex-shrink-0">
                            <Image
                              src={ep.stillPath || content.heroImage}
                              alt={ep.name}
                              fill
                              className="object-cover opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                              <Play className="w-8 h-8 text-white fill-current" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-white">{ep.name}</h4>
                              <span className="text-sm text-white">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                            </div>
                            <p className="text-xs text-[#777] line-clamp-2">{ep.overview || 'No description available for this episode.'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-20">No episodes found for this season.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}