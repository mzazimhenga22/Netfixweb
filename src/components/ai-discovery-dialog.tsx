
'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, Send, PlayCircle } from 'lucide-react';
import { personalizeContentRecommendations } from '@/ai/flows/personalized-recommendations';
import { MOCK_CONTENT } from '@/lib/mock-data';
import { MovieCard } from './movie-card';

export function AIDiscoveryDialog({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await personalizeContentRecommendations({ preferences: query });
      // Map AI recommendations to our mock content if possible, or just show them
      setRecommendations(result.recommendations);
    } catch (error) {
      console.error('AI Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
            <Sparkles className="w-6 h-6 text-accent" />
            AI Content Discovery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              placeholder="e.g., 'I want a sci-fi thriller set in space with a female lead'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-background border-border"
            />
            <Button disabled={loading} type="submit" className="bg-primary hover:bg-primary/90">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Consulting the vault archives...</p>
            </div>
          )}

          {!loading && recommendations.length > 0 && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <h3 className="font-semibold text-lg text-accent">Top Recommendations for You:</h3>
              {recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-background border border-border group hover:border-accent transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-headline font-bold text-xl">{rec.title}</h4>
                    <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">{rec.genre}</span>
                  </div>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{rec.synopsis}</p>
                  <Button variant="link" className="p-0 h-auto text-primary hover:text-primary/80 gap-1">
                    <PlayCircle className="w-4 h-4" /> View Details
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!loading && recommendations.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-border mx-auto mb-4" />
              <p className="text-muted-foreground">Tell the AI what you're in the mood for!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
