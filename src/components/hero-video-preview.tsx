'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { VidLinkResolver } from '@/components/vidlink-resolver';
import { VidLinkStream } from '@/lib/vidlink';
import { Volume2, VolumeX } from 'lucide-react';

interface HeroVideoPreviewProps {
  tmdbId: string;
  type: 'movie' | 'tv';
  /** Delay (ms) before starting resolution. Avoids blocking page load. */
  delay?: number;
  /** How long (seconds) to play the clip before stopping. 0 = unlimited */
  clipDuration?: number;
  isMuted: boolean;
  onReady?: () => void;
}

/**
 * HeroVideoPreview — Netflix-style silent video clip on the hero banner.
 * 
 * This component resolves a VidLink stream in the background and when ready,
 * fades in a muted, low-quality video over the hero image. Exactly how Netflix
 * does it — the clip starts ~3s after page load and plays for ~60s silently.
 * 
 * Performance considerations:
 * - Resolution is deferred by `delay` ms to not block initial page render
 * - HLS.js is configured to use the LOWEST quality level (saves RAM + bandwidth)
 * - Video stops after `clipDuration` seconds to not waste resources
 * - The iframe resolver is unmounted after stream is captured
 */
export function HeroVideoPreview({ 
  tmdbId, 
  type,
  delay = 3000,
  clipDuration = 60,
  isMuted,
  onReady
}: HeroVideoPreviewProps) {
  const [enabled, setEnabled] = useState(false);
  const [stream, setStream] = useState<VidLinkStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [resolverKey, setResolverKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRetriesRef = useRef(0);
  const usedDirectFallbackRef = useRef(false);

  // Delay starting the resolver to not block the page
  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const handleStreamResolved = useCallback((newStream: VidLinkStream) => {
    console.log('[HeroPreview] ✅ Stream resolved for hero clip');
    timeoutRetriesRef.current = 0;
    usedDirectFallbackRef.current = false;
    setStream(newStream);
  }, []);

  const handleError = useCallback((error: string) => {
    if (error === 'Stream resolution timed out' && timeoutRetriesRef.current < 2) {
      timeoutRetriesRef.current += 1;
      setResolverKey((k) => k + 1);
      return;
    }
    console.warn('[HeroPreview] Failed to resolve hero clip:', error);
    // Silent fail — hero just shows the static image
  }, []);

  useEffect(() => {
    timeoutRetriesRef.current = 0;
    setResolverKey(0);
    setStream(null);
  }, [tmdbId, type]);

  // Initialize HLS.js with LOWEST quality for minimal resource usage
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        startLevel: 0, // Start with LOWEST quality
        capLevelToPlayerSize: false,
        maxBufferLength: 15,
        maxMaxBufferLength: 30,
        maxBufferSize: 10 * 1024 * 1024, // 10MB max buffer
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
      });

      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Force lowest quality level to save bandwidth/RAM
        hls.currentLevel = 0;
        
        video.muted = true;
        
        // Wait for metadata to know duration, then seek to a random middle point
        const playClip = () => {
          if (video.duration > 180) {
            // Pick a random spot between 15% and 80% to simulate a 'trailer clip'
            const minStart = video.duration * 0.15;
            const maxStart = video.duration * 0.80;
            video.currentTime = minStart + Math.random() * (maxStart - minStart);
          }
          
          video.play().then(() => {
            // Fade in video after a brief moment to allow seeking/buffering
            setTimeout(() => {
              setIsVideoReady(true);
              setShowVideo(true);
              onReady?.();
            }, 1000);
          }).catch(() => {
            console.warn('[HeroPreview] Autoplay blocked');
          });
        };

        if (video.readyState >= 1) {
          playClip();
        } else {
          video.addEventListener('loadedmetadata', playClip, { once: true });
        }
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          if (
            data.type === Hls.ErrorTypes.NETWORK_ERROR &&
            !usedDirectFallbackRef.current &&
            stream.directUrl &&
            stream.url.startsWith('/api/vidlink/hls')
          ) {
            usedDirectFallbackRef.current = true;
            setStream((prev) => (prev ? { ...prev, url: prev.directUrl || prev.url } : prev));
            return;
          }
          console.warn('[HeroPreview] HLS fatal error, destroying');
          hls.destroy();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.muted = true;
      video.play().catch(() => {});
    }

    // Stop clip after clipDuration seconds
    if (clipDuration > 0) {
      stopTimeoutRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          setShowVideo(false);
        }
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        console.log('[HeroPreview] Clip auto-stopped after', clipDuration, 'seconds');
      }, clipDuration * 1000);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    };
  }, [stream, clipDuration, onReady]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Auto-pause/resume when scrolling out of view (Netflix style)
  useEffect(() => {
    const video = videoRef.current;
    // Only observe if the video element exists and we have started showing it
    if (!video || !showVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video is in view, resume playback
            video.play().catch(() => {});
          } else {
            // Video scrolled out of view, pause it to save CPU/RAM
            video.pause();
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% or less of the video is visible
    );
    
    observer.observe(video);
    return () => observer.disconnect();
  }, [showVideo]);

  return (
    <>
      {/* Hidden resolver — only active until stream is captured */}
      {enabled && !stream && (
        <VidLinkResolver
          tmdbId={tmdbId}
          type={type}
          resolverKey={resolverKey}
          enabled={true}
          onStreamResolved={handleStreamResolved}
          onError={handleError}
        />
      )}

      {/* Video layer — fades in over the hero image */}
      {stream && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ${
            showVideo ? 'opacity-100' : 'opacity-0'
          }`}
          playsInline
          muted={isMuted}
          loop={clipDuration === 0}
          style={{ zIndex: 2 }}
        />
      )}

      {/* Mute button removed from here, now handled by Hero parent for side-by-side layout */}
    </>
  );
}
