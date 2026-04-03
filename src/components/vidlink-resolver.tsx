'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { 
  parseVidLinkResponse,
  VidLinkStream 
} from '@/lib/vidlink';

interface VidLinkResolverProps {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  resolverKey?: number;
  onStreamResolved: (stream: VidLinkStream) => void;
  onError: (error: string) => void;
  enabled: boolean;
}

/**
 * VidLinkResolver Component (Web Version)
 * 
 * Web equivalent of the React Native hidden WebView approach.
 * Uses a hidden same-origin iframe (proxied through our API) to
 * execute VidLink's JavaScript and intercept the /api/b/ response.
 * 
 * Flow:
 * 1. Renders a hidden 1x1 iframe pointing to /api/vidlink/resolve?tmdbId=...
 * 2. Our proxy server fetches the VidLink page + injects interceptor script
 * 3. VidLink JS runs in the iframe, makes the /api/b/ call
 * 4. Interceptor catches response and sends it via window.postMessage
 * 5. This component receives the message, parses it, and calls onStreamResolved
 *    with the direct m3u8 URL — NO visible embed, just a direct link.
 */
export function VidLinkResolver({ 
  tmdbId, 
  type, 
  season, 
  episode,
  resolverKey = 0, 
  onStreamResolved, 
  onError,
  enabled 
}: VidLinkResolverProps) {
  const [hasResolved, setHasResolved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resolvedRef = useRef(false);

  // Build the proxy URL (same-origin, so postMessage works)
  const proxyUrl = (() => {
    const params = new URLSearchParams({ tmdbId, type });
    if (type === 'tv' && season) params.set('season', String(season));
    if (type === 'tv' && episode) params.set('episode', String(episode));
    params.set('_k', String(resolverKey)); // Ensure fresh URL load
    return `/api/vidlink/resolve?${params.toString()}`;
  })();

  // Reset when content or key changes
  useEffect(() => {
    setHasResolved(false);
    resolvedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [tmdbId, type, season, episode, resolverKey]);

  // Listen for postMessage from the proxied iframe
  useEffect(() => {
    if (!enabled || !tmdbId || hasResolved) return;

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our own origin (the proxy page is same-origin)
      if (event.origin !== window.location.origin) return;
      if (resolvedRef.current) return;

      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'VIDLINK_STREAM') {
        const stream = parseVidLinkResponse(message.data);
        if (stream) {
          console.log(`[VidLink] ✅ Stream resolved!`);
          console.log(`[VidLink] 🎬 URL: ${stream.url.substring(0, 100)}...`);
          console.log(`[VidLink] 📝 Captions: ${stream.captions.length}`);
          console.log(`[VidLink] 🔑 Headers:`, JSON.stringify(stream.headers));
          resolvedRef.current = true;
          setHasResolved(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          onStreamResolved(stream);
        } else {
          console.error('[VidLink] ❌ Failed to parse stream response');
          onError('Failed to parse stream data');
        }
      } else if (message.type === 'VIDLINK_TIMEOUT') {
        console.warn('[VidLink] ⏰ Resolution timed out');
        onError('Stream resolution timed out');
      } else if (message.type === 'VIDLINK_DEBUG') {
        console.log(`[VidLink] 🔍 Debug: ${message.data}`);
      }
    };

    window.addEventListener('message', handleMessage);

    // Set our own client-side timeout as safety net
    timeoutRef.current = setTimeout(() => {
      if (!resolvedRef.current) {
        console.warn('[VidLink] ⏰ Client-side timeout (30s)');
        onError('Stream resolution timed out');
      }
    }, 30000);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, tmdbId, type, season, episode, hasResolved, onStreamResolved, onError]);

  if (!enabled || !tmdbId || hasResolved) return null;

  console.log(`[VidLink] 🌐 Loading proxy resolver: ${proxyUrl}`);

  // Hidden iframe — web equivalent of the React Native 1x1 hidden WebView.
  // Completely invisible, just resolves the stream URL.
  return (
    <iframe
      ref={iframeRef}
      src={proxyUrl}
      title="vidlink-resolver"
      sandbox="allow-scripts allow-same-origin allow-forms"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        border: 'none',
        overflow: 'hidden',
        // Push it off-screen
        top: '-9999px',
        left: '-9999px',
      }}
      onLoad={() => {
        console.log('[VidLink] 📄 Proxy iframe loaded, waiting for stream...');
      }}
    />
  );
}
