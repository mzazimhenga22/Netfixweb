'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Volume1,
  Maximize, Minimize, Settings, MessageSquare, X, ChevronLeft,
  List, Check, Loader2, SkipForward, Flag
} from 'lucide-react';
import { Content, Episode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getEpisodes } from '@/lib/tmdb';
import { VidLinkResolver } from '@/components/vidlink-resolver';
import { VidLinkStream, VidLinkCaption, VidLinkSkipMarker } from '@/lib/vidlink';
import { useWatchHistory } from '@/hooks/use-watch-history';

interface VideoPlayerProps {
  content: Content;
  episode?: Episode;
  onClose: () => void;
}

interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

export function VideoPlayer({ content, episode: initialEpisode, onClose }: VideoPlayerProps) {
  // ─── Core State ───
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveStatus, setResolveStatus] = useState('Connecting...');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolverKey, setResolverKey] = useState(0);
  const consecutiveErrorsRef = useRef(0);

  // ─── Content State ───
  const [currentEpisode, setCurrentEpisode] = useState<Episode | undefined>(initialEpisode);
  const [episodesList, setEpisodesList] = useState<Episode[]>([]);
  const [stream, setStream] = useState<VidLinkStream | null>(null);

  // ─── Overlay Panels ───
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [isAudioSubOpen, setIsAudioSubOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ─── Subtitles ───
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null); // caption ID or null for off
  const [subtitleText, setSubtitleText] = useState('');

  // ─── Quality ───
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  
  // ─── Playback Speed ───
  const [playbackRate, setPlaybackRate] = useState(1);
  const { saveProgress } = useWatchHistory();
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // ─── Skip Markers ───
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [activeMarker, setActiveMarker] = useState<VidLinkSkipMarker | null>(null);

  // ─── Seek Preview ───
  const [seekHover, setSeekHover] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Refs ───
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const subtitleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const parsedCuesRef = useRef<Map<string, Array<{start: number; end: number; text: string}>>>(new Map());

  // ─── Computed ───
  const isMuted = volume === 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const captions = useMemo(() => stream?.captions || [], [stream]);
  const markers = useMemo(() => stream?.markers || [], [stream]);

  // ─── Load Episodes ───
  useEffect(() => {
    async function loadEpisodes() {
      if (content.type === 'tv-show') {
        try {
          const data = await getEpisodes(content.id, '1');
          setEpisodesList(data);
        } catch (error) {
          console.error('Failed to load episodes:', error);
        }
      }
    }
    loadEpisodes();
  }, [content.id, content.type]);

  const handleStreamResolved = useCallback((newStream: VidLinkStream) => {
    console.log(`[VideoPlayer] ✅ Stream resolved: ${newStream.url.substring(0, 100)}...`);
    setStream(newStream);
    setResolveStatus('Stream ready');
    consecutiveErrorsRef.current = 0; // Reset error counter on success
    // Auto-select first English subtitle if available
    const engSub = newStream.captions.find(c => 
      c.language.toLowerCase().includes('english')
    );
    if (engSub) setActiveSubtitle(engSub.id);
  }, []);

  const handleResolverError = useCallback((error: string) => {
    console.error('[VideoPlayer] Resolver error:', error);
    setResolveStatus('Failed to load stream');
    setIsLoading(false);
  }, []);

  // ─── HLS.js Initialization ───
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();

      const hls = new Hls({
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferHole: 0.5,
        lowLatencyMode: false,
        // Start playing as soon as we have a tiny bit buffered
        highBufferWatchdogPeriod: 2,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        xhrSetup: function (xhr) {
          if (stream.headers) {
            for (const [key, value] of Object.entries(stream.headers)) {
              try {
                xhr.setRequestHeader(key, value as string);
              } catch (e) {
                // Ignore unsafe headers that the browser manages automatically
              }
            }
          }
        }
      });

      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        console.log(`[VideoPlayer] ✅ Manifest parsed, ${data.levels.length} quality levels`);
        
        const levels: QualityLevel[] = data.levels.map((lvl, i) => ({
          index: i,
          height: lvl.height,
          width: lvl.width,
          bitrate: lvl.bitrate,
          label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
        }));
        setQualityLevels(levels);
        setIsLoading(false);
        setIsPlaying(true);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              consecutiveErrorsRef.current += 1;
              console.warn('[VideoPlayer] Fatal network error. Consecutive:', consecutiveErrorsRef.current);
              
              if (consecutiveErrorsRef.current >= 3) {
                console.warn('[VideoPlayer] Stream URL likely expired. Requesting fresh token...');
                hls.destroy();
                setStream(null);
                setResolveStatus('Token expired. Refreshing secure stream...');
                setIsLoading(true);
                setResolverKey(k => k + 1); // Trigger full proxy re-fetch for new token
              } else {
                console.warn('[VideoPlayer] Retrying network connection...');
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream]);

  // ─── Subtitle Parsing & Rendering ───
  useEffect(() => {
    if (!activeSubtitle || !stream) {
      setSubtitleText('');
      return;
    }

    const caption = captions.find(c => c.id === activeSubtitle);
    if (!caption) return;

    // Fetch and parse VTT
    const cacheKey = caption.url;
    if (!parsedCuesRef.current.has(cacheKey)) {
      fetch(caption.url)
        .then(r => r.text())
        .then(vttText => {
          const cues = parseVTT(vttText);
          parsedCuesRef.current.set(cacheKey, cues);
        })
        .catch(err => console.error('[Subtitles] Failed to load:', err));
    }

    // Poll current time and match cues
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const cues = parsedCuesRef.current.get(cacheKey);
      if (!cues) return;

      const time = video.currentTime;
      const activeCue = cues.find(c => time >= c.start && time <= c.end);
      setSubtitleText(activeCue?.text || '');
    }, 200);

    subtitleIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [activeSubtitle, stream, captions]);

  // ─── Skip Markers Logic ───
  useEffect(() => {
    if (!markers.length) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const t = video.currentTime;

      const intro = markers.find(m => m.type === 'intro');
      const outro = markers.find(m => m.type === 'outro');

      if (intro && t >= intro.start && t < intro.end) {
        setShowSkipIntro(true);
        setActiveMarker(intro);
      } else {
        setShowSkipIntro(false);
      }

      if (outro && t >= outro.start && t < outro.end) {
        setShowSkipOutro(true);
        setActiveMarker(outro);
      } else {
        setShowSkipOutro(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [markers]);

  // ─── Video Events ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      if (t > 0 && Math.floor(t) % 10 === 0) { // Call it roughly every 10 seconds. The hook natively throttles the firestore network request to once every 3 minutes.
         saveProgress(
           content, 
           content.type === 'tv-show' ? 'tv' : 'movie', 
           t, 
           video.duration, 
           currentEpisode?.seasonNumber, 
           currentEpisode?.episodeNumber
         );
      }
    };
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('progress', onProgress);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('progress', onProgress);
    };
  }, []);

  // ─── Sync Playback ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    if (isPlaying) video.play().catch(() => {});
    else video.pause();
  }, [isPlaying, stream]);

  // ─── Volume ───
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // ─── Playback Rate ───
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // ─── Quality ───
  const setQuality = useCallback((levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 = auto
      setCurrentQuality(levelIndex);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Force Save on Unmount ───
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.currentTime > 0) {
        saveProgress(
          content,
          content.type === 'tv-show' ? 'tv' : 'movie',
          videoRef.current.currentTime,
          videoRef.current.duration || Math.max(duration, 0),
          currentEpisode?.seasonNumber,
          currentEpisode?.episodeNumber,
          true // Force bypass throttle
        );
      }
    };
  }, [content, currentEpisode, duration, saveProgress]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  // ─── Keyboard Shortcuts ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEpisodesOpen || isAudioSubOpen || isSettingsOpen) {
        if (e.key === 'Escape') {
          setIsEpisodesOpen(false);
          setIsAudioSubOpen(false);
          setIsSettingsOpen(false);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
        case 'm':
          if (volume > 0) { setPrevVolume(volume); setVolume(0); }
          else setVolume(prevVolume || 1);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'escape':
          if (document.fullscreenElement) document.exitFullscreen();
          else onClose();
          break;
        case 'arrowleft':
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          handleSkip(10);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'c':
          // Toggle subtitles
          if (activeSubtitle) setActiveSubtitle(null);
          else {
            const eng = captions.find(c => c.language.toLowerCase().includes('english'));
            if (eng) setActiveSubtitle(eng.id);
            else if (captions.length > 0) setActiveSubtitle(captions[0].id);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEpisodesOpen, isAudioSubOpen, isSettingsOpen, volume, prevVolume, activeSubtitle, captions, toggleFullscreen]);

  // ─── Controls auto-hide ───
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isEpisodesOpen && !isAudioSubOpen && !isSettingsOpen) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, isEpisodesOpen, isAudioSubOpen, isSettingsOpen]);

  // ─── Helpers ───
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  const handleSkipMarker = () => {
    if (activeMarker && videoRef.current) {
      videoRef.current.currentTime = activeMarker.end;
    }
  };

  // ─── Seek ───
  const getSeekPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || duration === 0) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = getSeekPosition(e) * duration;
    }
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    setSeekHover(getSeekPosition(e) * duration);
  };

  const toggleMute = () => {
    if (volume > 0) { setPrevVolume(volume); setVolume(0); }
    else setVolume(prevVolume || 1);
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const anyPanelOpen = isEpisodesOpen || isAudioSubOpen || isSettingsOpen;

  // ─── Render ───
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      style={{ cursor: (showControls || anyPanelOpen || isLoading) ? 'default' : 'none' }}
    >
      {/* Video Element */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
        <video 
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          autoPlay
          crossOrigin="anonymous"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Backdrop while resolving */}
        {isLoading && !stream && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-[20px] scale-110 transition-all duration-1000"
            style={{ backgroundImage: `url(${currentEpisode?.stillPath || content.heroImage})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* VidLink Resolver */}
      <VidLinkResolver 
        tmdbId={content.id}
        type={content.type === 'tv-show' ? 'tv' : 'movie'}
        season={currentEpisode?.seasonNumber || 1}
        episode={currentEpisode?.episodeNumber}
        resolverKey={resolverKey}
        enabled={true}
        onStreamResolved={handleStreamResolved}
        onError={handleResolverError}
      />

      {/* ─── Netflix Subtitle Overlay ─── */}
      {subtitleText && (
        <div className="absolute bottom-[14%] left-0 right-0 flex justify-center z-[55] pointer-events-none px-8 transition-opacity duration-200">
          <div className="netflix-subtitle px-6 py-2 max-w-[80%]">
            <span 
              className="text-white text-[2.2vw] md:text-[1.6vw] lg:text-[1.3vw] font-semibold leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
              dangerouslySetInnerHTML={{ __html: subtitleText }}
            />
          </div>
        </div>
      )}

      {/* ─── Skip Intro Button ─── */}
      {showSkipIntro && (
        <button
          onClick={handleSkipMarker}
          className="absolute bottom-[18%] right-[5%] z-[80] border-2 border-white/60 bg-black/50 hover:bg-white hover:text-black text-white px-8 py-3 text-lg font-bold tracking-wider uppercase transition-all duration-200 backdrop-blur-sm animate-in slide-in-from-right-4"
        >
          Skip Intro <SkipForward className="w-5 h-5 inline ml-2" />
        </button>
      )}

      {/* ─── Skip Outro / Next Episode Button ─── */}
      {showSkipOutro && (
        <button
          onClick={handleSkipMarker}
          className="absolute bottom-[18%] right-[5%] z-[80] border-2 border-white/60 bg-black/50 hover:bg-white hover:text-black text-white px-8 py-3 text-lg font-bold tracking-wider uppercase transition-all duration-200 backdrop-blur-sm animate-in slide-in-from-right-4"
        >
          Skip Credits <SkipForward className="w-5 h-5 inline ml-2" />
        </button>
      )}

      {/* ─── Top Bar ─── */}
      <div className={cn(
        "absolute top-0 left-0 right-0 p-6 md:p-10 flex items-center justify-between transition-all duration-500 z-[60]",
        (showControls || anyPanelOpen) ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
      )}>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <ChevronLeft className="w-10 h-10 sm:w-12 sm:h-12" />
        </button>
        
        {/* Centered Title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h2 className="text-white/90 text-lg md:text-xl font-semibold tracking-tight truncate max-w-md">
            {content.title}
          </h2>
          {currentEpisode && (
            <p className="text-white/40 text-xs md:text-sm font-medium">
              S{currentEpisode.seasonNumber || 1}:E{currentEpisode.episodeNumber} "{currentEpisode.name}"
            </p>
          )}
        </div>

        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <X className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.5]" />
        </button>
      </div>

      {/* ─── Loading / Resolving Spinner ─── */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-[100] pointer-events-none gap-8">
          <div className="Netflix-spinner scale-[1.2] shadow-2xl drop-shadow-[0_0_15px_rgba(229,9,20,0.4)]" />
          {!stream && (
            <p className="text-white/50 text-sm font-medium tracking-wider animate-pulse uppercase mt-2">
              {resolveStatus}
            </p>
          )}
        </div>
      )}

      {/* ─── Center Play Button (paused state) ─── */}
      <div className={cn(
        "z-10 transition-all duration-300",
        (!isPlaying && !anyPanelOpen && !isLoading) ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )}>
        <button className="text-white" onClick={() => setIsPlaying(true)}>
          <Play className="w-28 h-28 fill-current drop-shadow-[0_0_40px_rgba(0,0,0,0.9)]" />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── OVERLAY: Episodes Panel ─── */}
      {isEpisodesOpen && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-[100] flex flex-col items-center pt-28 pb-12 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-full max-w-4xl px-8 flex flex-col h-full gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Episodes</h3>
              <button onClick={() => setIsEpisodesOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-10 h-10" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-4 scrollbar-hide py-2">
              {episodesList.map((ep) => (
                <div 
                  key={ep.id}
                  className={cn(
                    "flex items-center gap-6 p-5 rounded-md transition-all cursor-pointer group border-l-4",
                    currentEpisode?.id === ep.id 
                      ? "bg-white/10 border-[#e50914] shadow-xl" 
                      : "bg-transparent border-transparent hover:bg-white/5"
                  )}
                  onClick={() => {
                    setCurrentEpisode(ep);
                    setIsEpisodesOpen(false);
                    setIsLoading(true);
                    setStream(null);
                    setSubtitleText('');
                    parsedCuesRef.current.clear();
                  }}
                >
                  <div className="text-2xl font-black text-white/20 group-hover:text-white transition-colors w-8">{ep.episodeNumber}</div>
                  
                  {ep.stillPath && (
                    <div className="relative w-32 h-20 rounded-md overflow-hidden flex-shrink-0 shadow-md">
                      <img 
                        src={`https://image.tmdb.org/t/p/w300${ep.stillPath}`} 
                        alt={ep.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {currentEpisode?.id === ep.id && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xl font-bold text-white truncate pr-4">{ep.name}</h4>
                      {currentEpisode?.id === ep.id && !ep.stillPath && <Play className="w-5 h-5 text-white fill-current flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-white/50 line-clamp-2 leading-relaxed">{ep.overview || 'No description available.'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── OVERLAY: Audio & Subtitles Panel (Netflix Style) ─── */}
      {isAudioSubOpen && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#181818]/95 p-12 md:p-16 rounded-xl grid grid-cols-2 gap-16 md:gap-24 min-w-[500px] max-w-[700px] border border-white/10 relative shadow-2xl max-h-[80vh] overflow-y-auto">
            <button onClick={() => setIsAudioSubOpen(false)} className="absolute top-5 right-5 text-white/30 hover:text-white transition-colors">
              <X className="w-8 h-8" />
            </button>

            {/* Audio Column */}
            <div className="space-y-8">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-[0.3em] px-4">Audio</h3>
              <div className="space-y-1">
                {['English [Original]'].map((lang) => (
                  <button 
                    key={lang}
                    className="w-full text-left px-5 py-3 rounded-md transition-all flex items-center justify-between text-white font-black bg-white/10"
                  >
                    <span className="text-lg tracking-tight">{lang}</span>
                    <Check className="w-4 h-4 text-[#46d369] stroke-[3]" />
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitles Column - REAL from VidLink captions */}
            <div className="space-y-8">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-[0.3em] px-4">Subtitles</h3>
              <div className="space-y-1">
                {/* Off option */}
                <button 
                  className={cn(
                    "w-full text-left px-5 py-3 rounded-md transition-all flex items-center justify-between",
                    !activeSubtitle ? "text-white font-black bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => setActiveSubtitle(null)}
                >
                  <span className="text-lg tracking-tight">Off</span>
                  {!activeSubtitle && <Check className="w-4 h-4 text-[#46d369] stroke-[3]" />}
                </button>
                
                {/* Real captions from stream */}
                {captions.map((cap) => (
                  <button 
                    key={cap.id}
                    className={cn(
                      "w-full text-left px-5 py-3 rounded-md transition-all flex items-center justify-between",
                      activeSubtitle === cap.id ? "text-white font-black bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() => setActiveSubtitle(cap.id)}
                  >
                    <span className="text-lg tracking-tight">{cap.language}</span>
                    {activeSubtitle === cap.id && <Check className="w-4 h-4 text-[#46d369] stroke-[3]" />}
                  </button>
                ))}
                
                {captions.length === 0 && (
                  <p className="text-white/20 text-sm px-5 py-3 italic">No subtitles available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── OVERLAY: Settings Panel ─── */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#181818]/95 p-12 md:p-16 rounded-xl min-w-[400px] max-w-[500px] border border-white/10 relative shadow-2xl space-y-10">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-5 right-5 text-white/30 hover:text-white transition-colors">
              <X className="w-8 h-8" />
            </button>

            {/* Playback Speed */}
            <div className="space-y-6">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-[0.3em] px-4">Playback Speed</h3>
              <div className="flex items-center gap-2 px-4">
                {speeds.map(s => (
                  <button
                    key={s}
                    className={cn(
                      "flex-1 py-3 rounded-md text-center text-base font-bold transition-all",
                      playbackRate === s 
                        ? "bg-white text-black" 
                        : "text-white/50 hover:text-white hover:bg-white/10"
                    )}
                    onClick={() => setPlaybackRate(s)}
                  >
                    {s === 1 ? 'Normal' : `${s}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-6">
              <h3 className="text-white/30 text-xs font-black uppercase tracking-[0.3em] px-4">Quality</h3>
              <div className="space-y-1 px-4">
                {/* Auto option */}
                <button
                  className={cn(
                    "w-full text-left px-5 py-3 rounded-md transition-all flex items-center justify-between",
                    currentQuality === -1 ? "text-white font-black bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => setQuality(-1)}
                >
                  <span className="text-lg">Auto</span>
                  {currentQuality === -1 && <Check className="w-4 h-4 text-[#46d369] stroke-[3]" />}
                </button>
                {qualityLevels.sort((a, b) => b.height - a.height).map(lvl => (
                  <button
                    key={lvl.index}
                    className={cn(
                      "w-full text-left px-5 py-3 rounded-md transition-all flex items-center justify-between",
                      currentQuality === lvl.index ? "text-white font-black bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() => setQuality(lvl.index)}
                  >
                    <span className="text-lg">{lvl.label}</span>
                    <span className="text-xs text-white/30">{Math.round(lvl.bitrate / 1000)}kbps</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── Bottom Controls ─── */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 px-6 md:px-14 pb-8 md:pb-10 transition-all duration-500 z-50",
        (showControls && !anyPanelOpen) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"
      )}>
        
        {/* ─── Progress Bar ─── */}
        <div 
          ref={progressRef}
          className="relative group cursor-pointer h-[5px] hover:h-[7px] flex items-center w-full mb-6 transition-all"
          onClick={handleSeekClick}
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setSeekHover(null)}
        >
          {/* Background track */}
          <div className="absolute inset-x-0 h-full bg-white/20 rounded-full" />
          
          {/* Buffered track */}
          <div 
            className="absolute left-0 h-full bg-white/30 rounded-full"
            style={{ width: `${bufferedProgress}%` }}
          />
          
          {/* Skip markers on the timeline */}
          {markers.map((m, i) => {
            const startPct = duration > 0 ? (m.start / duration) * 100 : 0;
            const widthPct = duration > 0 ? ((m.end - m.start) / duration) * 100 : 0;
            return (
              <div 
                key={i}
                className="absolute h-full bg-yellow-400/40 rounded-full z-[5]"
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={`Skip ${m.type}`}
              />
            );
          })}
          
          {/* Played track */}
          <div 
            className="absolute left-0 h-full bg-[#e50914] rounded-full shadow-[0_0_12px_rgba(229,9,20,0.5)] z-10"
            style={{ width: `${progress}%` }}
          />
          
          {/* Seek hover preview time */}
          {seekHover !== null && (
            <div 
              className="absolute -top-10 bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded pointer-events-none z-20 -translate-x-1/2"
              style={{ left: `${(seekHover / duration) * 100}%` }}
            >
              {formatTime(seekHover)}
            </div>
          )}
          
          {/* Scrubber dot */}
          <div 
            className="absolute h-[16px] w-[16px] bg-[#e50914] border-2 border-white/30 rounded-full scale-0 group-hover:scale-100 transition-transform -ml-2 z-20 shadow-2xl"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* ─── Control Bar ─── */}
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-5 md:gap-8">
            <button className="text-white hover:scale-110 transition-transform" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current" />}
            </button>

            <button className="relative text-white hover:scale-110 transition-transform flex items-center justify-center" onClick={() => handleSkip(-10)}>
              <RotateCcw className="w-11 h-11 stroke-[1.5]" />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black pt-[3px] pr-[3px]">10</span>
            </button>
            <button className="relative text-white hover:scale-110 transition-transform flex items-center justify-center" onClick={() => handleSkip(10)}>
              <RotateCw className="w-11 h-11 stroke-[1.5]" />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black pt-[3px] pl-[3px]">10</span>
            </button>

            {/* Volume with Slider */}
            <div className="flex items-center gap-2 group/vol">
              <button className="text-white hover:scale-110 transition-transform" onClick={toggleMute}>
                <VolumeIcon className="w-9 h-9" />
              </button>
              <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 h-1 accent-white cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`,
                  }}
                />
              </div>
            </div>

            {/* Time */}
            <div className="text-white/90 text-base font-medium tracking-tight whitespace-nowrap">
              <span className="tabular-nums font-bold">{formatTime(currentTime)}</span>
              <span className="mx-2 text-white/25">/</span>
              <span className="text-white/40 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Center Title */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden max-w-xl">
            {currentEpisode ? (
              <div className="flex items-center gap-3">
                <div className="bg-white/10 backdrop-blur-lg px-3 py-1 rounded-sm border border-white/10">
                  <span className="text-white text-xs md:text-sm font-black uppercase tracking-[0.15em] whitespace-nowrap">
                    S{currentEpisode.seasonNumber || 1} • E{currentEpisode.episodeNumber}
                  </span>
                </div>
                <span className="text-[#46d369] font-semibold text-lg truncate">{currentEpisode.name}</span>
              </div>
            ) : (
              <span className="text-white/60 font-semibold text-lg truncate">{content.title}</span>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-5 md:gap-8">
            {content.type === 'tv-show' && (
              <button 
                className="text-white/60 hover:text-white transition-all hover:scale-110 flex flex-col items-center gap-0.5 group"
                onClick={() => setIsEpisodesOpen(true)}
              >
                <List className="w-8 h-8" />
                <span className="text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Episodes</span>
              </button>
            )}
            <button 
              className="text-white/60 hover:text-white transition-all hover:scale-110 flex flex-col items-center gap-0.5 group"
              onClick={() => setIsAudioSubOpen(true)}
            >
              <MessageSquare className="w-8 h-8" />
              <span className="text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Subs</span>
            </button>
            <button 
              className="text-white/60 hover:text-white transition-all hover:scale-110 flex flex-col items-center gap-0.5 group"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="w-8 h-8" />
              <span className="text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                {playbackRate !== 1 ? `${playbackRate}x` : 'Settings'}
              </span>
            </button>
            <button 
              className="text-white/60 hover:text-white transition-all hover:scale-110"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="w-8 h-8" /> : <Maximize className="w-8 h-8" />}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        
        /* Netflix-style subtitle rendering */
        .netflix-subtitle {
          background: rgba(0, 0, 0, 0.75);
          border-radius: 4px;
          text-align: center;
          line-height: 1.4;
          text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5);
        }
        
        /* Volume slider styling */
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          border-radius: 999px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}

// ─── VTT Parser ───
function parseVTT(vttText: string): Array<{start: number; end: number; text: string}> {
  const cues: Array<{start: number; end: number; text: string}> = [];
  const lines = vttText.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for timestamp lines: 00:01:23.456 --> 00:01:25.789
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim());
      const start = parseTimestamp(startStr);
      const end = parseTimestamp(endStr);
      
      // Collect text lines
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }
      
      if (textLines.length > 0 && start >= 0 && end > start) {
        cues.push({
          start,
          end,
          text: textLines.join('<br/>'),
        });
      }
    }
    i++;
  }

  return cues;
}

function parseTimestamp(ts: string): number {
  // Handle both HH:MM:SS.mmm and MM:SS.mmm formats
  const parts = ts.split(':');
  const seconds = parseFloat(parts.pop() || '0');
  const minutes = parseInt(parts.pop() || '0', 10);
  const hours = parseInt(parts.pop() || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}
