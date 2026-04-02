
'use client';

import { Navbar } from '@/components/layout/navbar';
import { MOCK_CONTENT } from '@/lib/mock-data';
import { MovieCard } from '@/components/movie-card';
import { useWatchlist } from '@/hooks/use-store';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookmarkX } from 'lucide-react';

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();
  const myWatchlist = MOCK_CONTENT.filter(c => watchlist.includes(c.id));

  return (
    <main className="min-h-screen bg-background pt-24 px-4 sm:px-12 pb-20">
      <Navbar />
      
      <div className="mb-10">
        <h1 className="text-3xl font-headline font-bold mb-2">My List</h1>
        <p className="text-muted-foreground">Content you've saved to watch later.</p>
      </div>

      {myWatchlist.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
          {myWatchlist.map(content => (
            <MovieCard key={content.id} content={content} onPlay={() => {}} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center gap-6">
          <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center">
            <BookmarkX className="w-10 h-10 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold">Your list is empty.</p>
            <p className="text-muted-foreground max-w-xs mx-auto">Add movies and shows you want to watch later and they'll show up here.</p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 rounded-sm">
            <Link href="/">Browse Home</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
