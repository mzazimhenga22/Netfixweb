'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getContentDetails } from '@/lib/tmdb';
import { Content } from '@/lib/types';
import { VideoPlayer } from '@/components/video-player';

export default function WatchPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      if (!id) return;
      try {
        // Try fetching as movie first
        let data;
        try {
          data = await getContentDetails(id, 'movie');
        } catch {
          data = await getContentDetails(id, 'tv-show');
        }
        setContent(data);
      } catch (error) {
        console.error('Failed to load content for player:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="Netflix-spinner" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <h1 className="text-2xl font-bold">Content not found</h1>
        <button onClick={() => router.back()} className="text-white hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <VideoPlayer 
      content={content} 
      onClose={() => router.back()} 
    />
  );
}
